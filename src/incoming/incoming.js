const fs = require( 'fs' );
const jsonStableStringify = require( 'json-stable-stringify' );
const nodegit = require( 'nodegit' );
const shell = require( 'shelljs' );
const path = require( 'path' );
const globby = require( 'globby' );

const execAsync = require( '../../../local_modules/execasync' );


// config.api.incoming.*
const config = require( 'rc' )( '3cidev' );


// cache
const threejsGitPath = path.join( config.root, config.threejsRepository );
const defaultExecOptions = { cwd: threejsGitPath, encoding: 'utf8', silent: true };


// database interface
const Database = require( 'better-sqlite3' );
const db = new Database( path.join( config.root, config.api.database ), { fileMustExist: true } );


// helpers
const DB = require( '../Database' );
DB.db = db; // TODO: unify configs, remove this
const Dependencies = require( '../helpers/Dependencies' );
const Run = require( '../helpers/Run' );
const Revision = require( '../helpers/Revision' );
const Overview = require( '../helpers/Overview' );
const Test = require( '../helpers/Test' );
const File = require( '../helpers/File' );
const { getBase, getParent, isBase } = require( '../helpers/History' );
const Results = require( '../helpers/Results' );

// summing up all errors across all tests,
// hits per files, etc.
const aggregatorOverview = require( './aggregators/overview' );
const aggregatorFiles = require( './aggregators/files' );
const aggregatorErrors = require( './aggregators/errors' );


// logging
const { Signale } = require( 'signale' );
const logger = new Signale( { scope: 'API Incoming', config: { displayTimestamp: true, displayDate: true } } );

if ( process.env.NODE_ENV === 'TESTING' )
	logger.disable();


// active checks
const checks = [
	'DocsExamples', //'checkDocsForBrokenExampleLinks',
	'DocsExternals', //'checkDocsForBrokenExternalLinks',
	'NonDocsExternals', //'checkNonDocsForBrokenExternalLinks',
	// 'checkNpmForOutdatedDeps',
	// 'checkWithTSCompiler',
	'DocsDecl', //'compareDeclarationsWithDocs',
	'ObjDecl', //'compareDeclarationsWithInstancedObjects',
	'SrcDecl', //'compareDeclarationsWithSource',
	'UnitTests', //'runUnitTests',
	'CompSrcExp', //'compareSourceExports',
	'CompExmplsExp', //'compareExamplesExports',
	'LawVsReality'
];

// active linters
const linters = [
	'DoobsDoc', //'doobDoc',
	'ESLintCodeTags',
	'ESLintJsFiles',
	'ESLintScriptTags',
	'HTMLLint',
	'ESLintTsFiles',
	'StyleLint'
];

// active dependencies checks
const dependencies = [
	'DocsDocsDeps'
];

// active profiles
const profiles = [
	'ProfConsole'
];


const sqlInsertErrorsResult = db.prepare( 'INSERT OR REPLACE INTO errors ( `runId`, `testId`, `value` ) VALUES ( ?, ?, ? )' );


class Incoming {

	createRevision() {

		this.revision = new Revision();
		this.revision.sha = this.sha;
		this.revision.save(); // INSERT OR IGNORE

	}


	async getTimestamps() {

		const repository = await nodegit.Repository.open( threejsGitPath );
		const commitDate = ( await repository.getCommit( this.sha ) ).date();

		this.timestamp = commitDate.getTime();
		this.delay = Math.ceil( ( new Date() - commitDate ) / 1000 );

	}


	loadOrCreateRun() {

		try {

			this.run = Run.loadByRevisionId( this.revision.revisionId );

		} catch ( err ) {

			// failed to find a run?
			this.run = new Run();

			this.run.revision = this.revision;
			this.run.overview = null;

			this.run.reason = 'CI';
			this.run.fullSizeEntry = isBase( this.revision.sha ) ? 'true' : 'false';
			this.run.machineId = 1;
			this.run.majorErrors = 0;

		}

		// Update these no matter whether we found a pre-existing run
		this.run.timestamp = this.timestamp;
		this.run.delayAfterCommit = this.delay;

		this.run.save(); // TODO: remove?

	}


	findBaseline() {

		try {

			this.baseSha = getBase( this.sha, defaultExecOptions.cwd );

		} catch ( err ) {

			if ( this.run.fullSizeEntry === 'false' ) {

				logger.error( `Not a fullSizeEntry but couldn't find a baseline, aborting: ${this.sha}, ${err}` );

				throw new Error( `Couldn't determine baseline run, but we're full size` );

			}

			logger.error( `Couldn't find base commit: ${this.sha}`, err );

		}

		// TODO: baseSha can be merged into this.run.baselineRun, no? check all calls

		// set it as baselineRunId
		if ( this.baseSha !== null ) {	// Note: case "! baseSha" will be handled later

			logger.log( `Base SHA for ${this.sha}: ${this.baseSha}` );

			const baseRev = new Revision();
			baseRev.sha = this.baseSha;
			baseRev.save(); // save is INSERT OR IGNORE for revision

			try {

				this.run.baselineRun = Run.loadByRevisionId( baseRev.revisionId );

			} catch ( err ) {

				logger.error( `Couldn't load baseline run: ${err}` );
				this.run.baselineRun = null;

			}

		}

	}


	findParent() {

		try {

			this.parentSha = getParent( this.sha, defaultExecOptions.cwd );

		} catch ( err ) {

			logger.error( `Couldn't find parent commit: ${this.sha}`, err );

		}

		// TODO: see baseSha, parentSha could be merged into run.parentRun
		// set as parentRunId
		if ( this.parentSha ) {	// Note: case "! parentSha" will NOT be handled later, we just leave it at NULL

			logger.log( `Parent SHA for ${this.sha}: ${this.parentSha}` );

			try {

				const parentRev = new Revision();
				parentRev.sha = this.parentSha;
				parentRev.save(); // save is INSERT OR IGNORE for revision

				this.run.parentRun = Run.loadByRevisionId( parentRev.revisionId );

			} catch ( err ) {

				logger.error( `Couldn't process parent run: ${err}` );
				this.run.parentRun = null;

			}

		}

	}


	async readResults() {

		const resultsFilesSplit = this.resultFiles.map( filepath => filepath.split( /[\/\-\.]/g ) );

		for ( const [ category, test, sha ] of resultsFilesSplit ) {

			this.results[ category ][ test ] = await fs.promises.readFile( path.join( config.api.ci.jsonPath, category, `${test}-${sha}.json` ), 'utf8' )
				.then( json => JSON.parse( json ) )
				.then( json => {

					// Why this is here:
					// ProfConsole is one big task results file, like the static task results
					// *But*, in delta mode, it only contains the 'delta-ed' results - unlike the static task results
					// So we have to re-read the old base results, craft the new results onto them, and then update the total hits counter
					// so that our aggregators receive correct data
					// Otherwise we would get OverviewTable results like 'current: 1, parent: 1385, base: 1385' because we
					// didn't count the previous results.
					// TODO: this should nevertheless be possible in a less hacky way, no?
					// TODO: also .error and .results[].error handling
					if ( this.run.fullSizeEntry === 'false' && this.run.baselineRun && test === 'ProfConsole' ) {

						return fs.promises.readFile( path.join( config.api.ci.jsonPath, category, `ProfConsole-${this.run.baselineRun.revision.sha}.json` ), 'utf8' )
							.then( json => JSON.parse( json ) )
							.then( baseResults => {

								const merged = {
									...baseResults.results,
									...json.results
								};

								const newTotalHits = Object.keys( merged ).reduce( ( total, filename ) => {

									total += merged[ filename ].results.length;

									return total;

								}, 0 );

								json.hits = newTotalHits;
								json.results = merged;

								return json;

							} );

					}

					return json;

				} )
				.catch( err => {

					logger.error( `readResults failed for: ${category}/${test}-${sha}.json ->`, err );

					throw err;

				} );

		}

	}


	collectStats() {

		const categories = [ 'checks', 'linters', 'dependencies', 'profiles' ]; // TODO: global? this.?

		// TODO: keep this? what if we have 0 linter results for example?
		if ( categories.some( x => typeof this.results[ x ] === 'undefined' || this.results[ x ] === null ) )
			logger.warn( `Invalid results passed to collectStats: ${Object.keys( this.results )} | ${categories.filter( c => ! c in this.results || this.results[ c ] === null ).join( ' ' )}` );

		// count major errors
		const majorErrors = [
			...Object.entries( this.results.checks ),
			...Object.entries( this.results.linters ),
			...Object.entries( this.results.dependencies ),
			...Object.entries( this.results.profiles )
		].reduce( ( totalSum, [ test, root ] ) => {

			if ( ! test || ! root )
				return totalSum;

			if ( ! root.errors || root.errors.length === 0 ) {

				logger.debug( `No errors on ${test}` );

			} else {

				logger.warn( `${root.errors.length} major errors on ${test}:`, root.errors );

				totalSum += root.errors.length;

			}

			return totalSum;

		}, 0 );

		this.run.majorErrors = ( majorErrors <= 0 ) ? 0 : majorErrors; // FIXME: -1?

		// count total hits per test
		this.stats.overview = aggregatorOverview( this.results, checks, linters, dependencies, profiles );

		// count hits per file
		this.stats.files = aggregatorFiles( this.results, checks, linters, dependencies, profiles );

		// count errors per test
		this.stats.errors = aggregatorErrors( this.results, checks, linters, dependencies, profiles );

	}


	calcOverview() {

		// New: We're not doing anything here. A run's reduced overview is all that's saved in the DB and nothing more.
		//		Any deltas or historical values are added during runtime

		/*
			This fills up a child's overview with missing values from baseline.
			Downside: should we ever add re-testing of existing runs, then we would have to reprocess every child's overview

		const baselineOverview = ( this.run.baselineRun && this.run.baselineRun.overview ) ? this.run.baselineRun.overview : new Overview();

		for ( const task of Object.keys( baselineOverview.overviewJson ) ) {

			if ( task in this.stats.overview )
				continue;

			this.stats.overview[ task ] = baselineOverview.overviewJson[ task ];

		}
		*/


		/*
			This is how it used to be, copied values and pre-calculated deltas

		const baselineOverview = ( this.run.baselineRun && this.run.baselineRun.overview ) ? this.run.baselineRun.overview : new Overview();
		const parentOverview = ( this.run.parentRun && this.run.parentRun.overview ) ? this.run.parentRun.overview : new Overview();

		for ( const key of Object.keys( this.stats.overview ) ) {

			if ( parentOverview.overviewJson[ key ] && 'result' in parentOverview.overviewJson[ key ] ) {

				this.stats.overview[ key ].parent = parentOverview.overviewJson[ key ].result;
				this.stats.overview[ key ].parentDelta = 1 - parentOverview.overviewJson[ key ].result / this.stats.overview[ key ].result;

			} else {

				logger.warn( `${key} missing from parent's overview` );

			}

			if ( baselineOverview.overviewJson[ key ] && 'result' in baselineOverview.overviewJson[ key ] ) {

				this.stats.overview[ key ].baseline = baselineOverview.overviewJson[ key ].result;
				this.stats.overview[ key ].baselineDelta = 1 - baselineOverview.overviewJson[ key ].result / this.stats.overview[ key ].result;

			} else {

				logger.warn( `${key} missing from baseline's overview` );

			}

		}
*/

	}


	saveOverview() {

		const overviewObj = new Overview();
		overviewObj.overviewJson = jsonStableStringify( this.stats.overview );
		overviewObj.save();
		this.run.overview = overviewObj;

	}


	saveErrors() {

		logger.log( 'Cleaning errors...' );

		this.run.cleanErrors();

		for ( const testName in this.stats.errors ) {

			logger.debug( `Test: '${testName}', Errors: ${this.stats.errors[ testName ]}` );

			const test = Test.loadByName( testName );

			sqlInsertErrorsResult.run( this.run.runId, test.testId, this.stats.errors[ testName ] );

		}

	}


	async findAllDependencies() {

		// globby is true async, unlike promisified-glob. apparently that was slowing down the event loop too much
		const allResults = await globby( path.posix.join( 'dependencies', '**', `*_parsed-${this.sha}.json` ), { cwd: config.api.ci.jsonPath, absolute: true } );

		this.allDeps = allResults.reduce( ( all, file ) => {

			const ex = path.basename( file )
				.replace( 'examples_', 'examples/' )
				.replace( `_parsed-${this.sha}.json`, '.html' );

			const deps = Incoming.readFilenames( file, file.replace( '_parsed', '_packed' ) );

			if ( deps.length > 0 )
				all[ ex ] = deps;

			return all;

		}, {} );

	}


	parseGitDiff() {

		this.gitDiff = {
			all: [],
			deleted: [],
			modified: [],
			added: []
		};

		if ( this.run.fullSizeEntry === 'false' ) {

			const delQuery = shell.exec( `git diff --name-status ${this.sha}^1 ${this.sha}`, defaultExecOptions );
			if ( delQuery.code !== 0 )
				throw new Error( { message: 'git diff failed', code: delQuery.code, stdout: delQuery.stdout, stderr: delQuery.stderr } );

			try {

				this.gitDiff = Dependencies.parseGitDiff( delQuery.stdout );

			} catch ( err ) {

				throw new Error( { message: 'parsing the git diff failed', err } );

			}

		}

	}


	_isThisBase() {

		return ( ! this.baseSha || ! this.run.baselineRun || isBase( this.sha, defaultExecOptions.cwd ) );

	}


	saveDependencies() {

		this.gitDiff.deleted.forEach( del => {

			if ( del in this.allDeps || /^examples\/.+?\.html$/i.test( del ) )
				this.allDeps[ del ] = null;

		} );

		logger.debug( 'Saving deps... fullSizeEntry?', this.run.fullSizeEntry );

		let baseDependencies;
		let baseDependenciesFormatted;
		try {

			baseDependencies = ( this.run.fullSizeEntry === 'true' || this.run.baselineRun === null ) ? null : Dependencies.loadByRevisionId( this.run.baselineRun.revisionId );
			baseDependenciesFormatted = ( baseDependencies !== null ) ? Dependencies.reformatToSourceBased( baseDependencies ) : null;

		} catch ( err ) {

			logger.error( `Loading baseline dependencies failed: ${this.sha}, ${err}` );

			throw new Error( `saveDependencies: Loading baseline dependencies failed: ${this.sha}: ` + err.message );

		}

		if ( this.run.fullSizeEntry === 'false' && baseDependenciesFormatted === null ) {

			logger.error( `Not a fullSizeEntry but failed loading baseline dependencies: ${this.sha}` );

			// throw new Error( 'saveDependencies: Failed loading baseline dependencies' );

		}


		try {

			Dependencies.saveDependencies(
				this.run.revisionId,			// the revId we want to associate this run with
				this.allDeps,					// current run's dependencies
				baseDependenciesFormatted !== null ?
					baseDependenciesFormatted :	// our baseline run's deps
					null						// no previous dependencies to diff against if we're a baseline run
			);

		} catch ( err ) {

			// throw new Error( { message: 'Dependencies.saveDependencies call failed', err } );
			throw new Error( 'Dependencies.saveDependencies call failed:' + err.message );

		}

		logger.success( 'Deps saved' );

	}


	// TODO: split into results/tests
	saveResults() {

		this.run.cleanResults();

		logger.log( 'Saving results...' );

		for ( const testName in this.stats.files ) {

			logger.debug( 'Test:', testName );

			const test = Test.loadByName( testName );

			for ( const file in this.stats.files[ testName ].files ) {

				// otherwise we have files like 'api/en/objects/Object3d' plus 'docs/api/en/objects/Object3d.html' (e.g.)
				// FIXME: normalize names when they're first logged
				const fullFile = ( file.startsWith( 'api/' ) === true && file.endsWith( '.html' ) === false ) ? `docs/${file}.html` : file;

				const fileObj = new File();
				fileObj.name = fullFile;
				fileObj.save();

				const value = this.stats.files[ testName ].files[ file ];

				if ( value === undefined || value === null || value < 0 ) {

					// TODO: fail hard?
					logger.error( `Skipping invalid value for test '${testName}' and file '${file}': '${value}'` );

					continue;

				}

				Results.saveResult(
					this.run.runId,
					test.testId,
					fileObj.fileId,
					value,
					( this.run.fullSizeEntry === 'false' && this.run.baselineRunId ) ? this.run.baselineRunId : - 1
				);

			}

		}

		logger.success( 'Results saved' );


		//
		// NULL-ing results refers to setting the test result in the DB to NULL
		// so that, when delta decoding kicks in, we can exclude these from the final
		// results. It's essentially deleting them from the merged set of base + child.
		// If we have no baseline to begin with, we can obviously skip this.
		//
		if ( this.run.baselineRunId === null ) {

			logger.log( 'No point in nulling, we have no baseline' );

			return;

		} else if ( this.run.fullSizeEntry === 'true' ) {

			logger.log( 'No point in nulling, we are a fullSizeEntry' );

			return;

		} else {

			logger.log( 'Nulling results...' );

		}


		const baseResults = Results.loadByRunId( this.run.baselineRunId );
		const baseResultsFileBased = Results.reformatToFileBased( baseResults );

		//
		// UNMODIFIED FILES:
		// Static tests like check-for-404-links can differ in results no matter the modification state
		// of the underlying file.
		//
		const allTests = Test.loadAll();
		const allFiles = File.loadAll();
		for ( const file of allFiles ) {

			if ( file.fileId in baseResultsFileBased === true ) {

				if ( file.name in this.gitDiff.modified === false ) {

					if ( file.name in this.gitDiff.deleted === false ) {

						// logger.fav( 'File', file.name, 'was neither modified nor deleted and appeared in baseResults' );

						for ( const result of baseResultsFileBased[ file.fileId ] ) {

							const test = allTests.find( t => t.testId === result.testId );

							if ( typeof this.stats.files[ test.name ] === 'undefined' )
								continue;

							if ( typeof this.stats.files[ test.name ].files[ file.name ] === 'undefined' ) {

								// logger.success( `${file.name} does not appear in the results for test ${test.name}\n` );

								Results.saveResult(
									this.run.runId,
									test.testId,
									file.fileId,
									null,
									( this.run.fullSizeEntry === 'false' && this.run.baselineRunId ) ? this.run.baselineRunId : - 1
								);

							} else if ( this.stats.files[ test.name ].files[ file.name ] !== result.value ) {

								// logger.success( `${file.name} has a differing result for test ${test.name}\n` );

								Results.saveResult(
									this.run.runId,
									test.testId,
									file.fileId,
									this.stats.files[ test.name ].files[ file.name ],
									( this.run.fullSizeEntry === 'false' && this.run.baselineRunId ) ? this.run.baselineRunId : - 1
								);

							}

						}

					}

				}

			}

		}


		//
		// MODIFIED FILES:
		// Go thru all modified files and look for those that can be found in the baseline run's results
		// but are missing from our current run's results.
		// They most likely were fixed (hence 0 hits now) but were broken before. Since we're using delta
		// encoding for our results, we have to actively NULL the result for this file so it doesn't get
		// copied over from the baseline run.
		//
		for ( const file of this.gitDiff.modified ) {

			logger.info( file, 'was modified' );

			//
			// First try and load the file from the DB
			//
			let fileObj;

			try {

				fileObj = File.loadByName( file );

			} catch ( err ) {

				logger.error( `Couldn't load file ${file}, can't null it: ${err}` );

				continue;

			}


			//
			// If it's not in the baseline results, we don't have to NULL it because
			// it wouldn't get copied over during delta decoding
			//
			if ( fileObj.fileId in baseResultsFileBased === false ) {

				logger.info( fileObj.name, '/', fileObj.fileId, 'not in baseResultsFileBased' );

				continue;

			}


			//
			// Look up which of the baseline run tasks mention the file
			//
			const baseResultsTestnames = baseResultsFileBased[ fileObj.fileId ].map( r => Test.loadByTestId( r.testId ).name || 'missing?' );
			logger.info( `it's in the following base tests: ${baseResultsTestnames.join( ', ' )}` );


			//
			// For all result categories, i.e. checks, linters, dependencies, profiles
			//
			for ( const category of Object.keys( this.results ) ) {

				//
				// and for every test in those categories, e.g. 'check docs for broken example links'
				//
				for ( const test in this.results[ category ] ) {

					// most likely UnitTests results
					if ( typeof this.results[ category ][ test ][ 'results' ] === 'undefined' )
						continue;


					//
					// it's actually in the 'category' > 'test' results of our current run,
					// so we're done here since it will override the baseline run results
					// during delta
					//
					if ( fileObj.name in this.results[ category ][ test ].results ) {

						logger.info( `locally in ${category} > ${test} with ${this.results[ category ][ test ].results[ fileObj.name ]}` );

					} else {

						logger.debug( `it's not in here: ${test}` );

						//
						// it's not in our current results, but it *is* in the baseline results
						// which means it was modified somewhere in between and now is either fixed
						// or deleted (or moved/renamed) and we have to NULL it to exclude it from the results
						//
						if ( baseResultsTestnames.includes( test ) ) {

							logger.info( `! it's in baseline results, hence it has been modified -> NULL it` );

							const testId = Test.loadByName( test ).testId; // TODO: cache this

							logger.debug( 'Nulling', { testId, fileId: fileObj.fileId } );

							// save with NULL as value and no delta encoding
							Results.saveResult( this.run.runId, testId, fileObj.fileId, null, - 1 );

						}

					}

				}

			}

		}


		//
		// DELETED FILES:
		// Files that were deleted are also missing from our current run's results, so we
		// have to NULL them as well, or they would get brought back to live during delta
		//
		for ( const file of this.gitDiff.deleted ) {

			// otherwise we have files like 'api/en/objects/Object3d' plus 'docs/api/en/objects/Object3d.html' (e.g.)
			// FIXME: normalize names when they're first logged
			const fullFile = ( file.startsWith( 'api/' ) === true && file.endsWith( '.html' ) === false ) ? `docs/${file}.html` : file;

			let fileObj;

			try {

				fileObj = File.loadByName( fullFile );

			} catch ( err ) {

				logger.error( `Couldn't load file ${fullFile}, can't null it: ${err}` );

				continue;

			}

			//
			// Deleted, yes, but it wasn't in the baseline results anyway, done
			//
			if ( fileObj.fileId in baseResultsFileBased === false ) {

				logger.info( fileObj.name, '/', fileObj.fileId, 'not in baseResultsFileBased' );

				continue;

			}


			//
			// Found one that was logged in baseline and deleted somewhere in
			// between, NULL it
			//
			for ( const result of baseResultsFileBased[ fileObj.fileId ] ) {

				const testId = result.testId;

				logger.debug( 'Nulling', { testId, fileId: fileObj.fileId } );

				Results.saveResult( this.run.runId, testId, fileObj.fileId, null, - 1 );

			}

		}

		//
		// Fin.
		//
		logger.success( 'Results nulled' );

	}


	async checkFileAvailablity() {

		// globby is true async, unlike promisified-glob. apparently that was slowing down the event loop too much
		const allKnownTests = `{${[ ...checks, ...linters, ...dependencies, ...profiles ].join( ',' )}}`;
		this.resultFiles = await globby(
			path.posix.join( '{checks,linters,dependencies,profiles}', `${allKnownTests}-${this.sha}.json` ), {
				cwd: config.api.ci.jsonPath,
				absolute: false
			} );

		// was an archive uploaded?
		const dependenciesArchivePath = path.join( config.api.ci.jsonPath, 'dependencies', `${this.sha}.tar.gz` );
		const dependenciesArchive = fs.existsSync( dependenciesArchivePath );

		// complain if we could process more than we can find
		const shouldBeLength = checks.length + linters.length + dependencies.length + profiles.length;
		if ( this.resultFiles.length < shouldBeLength || dependenciesArchive === false )
			logger.warn( `endRun called while still missing possible results - got: ${this.resultFiles.length} know: ${shouldBeLength} archive: ${dependenciesArchive}` );

		// early exit
		if ( dependenciesArchive !== true )
			return;

		// try extracting the archive
		try {

			const tarResult = await execAsync( `tar xzf ${this.sha}.tar.gz`, { ...defaultExecOptions, cwd: path.join( config.api.ci.jsonPath, 'dependencies' ) } );

			if ( tarResult.code !== 0 )
				logger.error( `Extraction of ${dependenciesArchivePath} failed: ${tarResult.code} ${tarResult.stdout} ${tarResult.stderr}` );

		} catch ( err ) {

			logger.error( `Tar failed:`, err );

			throw new Error( 'Extraction failed' );

		}

	}


	/**
	 * @param {import('express').Request} req
	 * @param {import('express').Response} res
	 */
	async endRun( req, res ) {

		this.sha = req.params.sha;

		this.results = {
			checks: {},
			linters: {},
			dependencies: {},
			profiles: {}
		};

		this.stats = {};

		// TODO: what if a file is missing from results, but it hasn't been modified/deleted?


		// Step 0:
		// Check which task results are available and extract any packed results
		try {

			await this.checkFileAvailablity();

		} catch ( err ) {

			logger.error( `Couldn't check file availablity: ${this.sha}`, err );

			res.status( 500 ).send( 'Internal Error: checkFileAvailablity failed' );

			return false;

		}


		// Step 1:
		// Create the submitted revision
		try {

			this.createRevision();

		} catch ( err ) {

			logger.error( `Couldn't create revision: ${this.sha}`, err );

			res.status( 500 ).send( 'Internal Error: createRevision failed' );

			return false;

		}


		// Step 2:
		// Lookup the commit and note delay between committing and finishing CI
		try {

			await this.getTimestamps();

		} catch ( err ) {

			logger.error( `Couldn't access base repository / fetch the commit: ${this.sha}`, err );

			res.status( 500 ).send( 'Internal Error: Commit not found' );

			return false;

		}


		// Step 3:
		// Create the skeleton run object or load an existing one
		try {

			this.loadOrCreateRun();

		} catch ( err ) {

			logger.error( `Couldn't load or create run: ${this.sha}`, err );

			res.status( 500 ).send( 'Internal Error: loadOrCreateRun failed' );

			return false;

		}


		// Step 4:
		// Find the baseline commit and set its run as baselineRunId
		try {

			this.findBaseline();

		} catch ( err ) { // only `new Revision` or `revision.save` can throw

			logger.error( `Couldn't initialize a baseline revision: ${this.sha}`, err );

			res.status( 500 ).send( 'Internal Error: findBaseline failed' );

			return false;

		}


		// Step 5:
		// Find the parent commit...
		try {

			this.findParent();

		} catch ( err ) { // only `new Revision` or `revision.save` can throw

			logger.error( `Couldn't initialize the parent revision: ${this.sha}`, err );

			res.status( 500 ).send( 'Internal Error: findParent failed' );

			return false;

		}


		// Step 6:
		// Parse the git diff
		try {

			this.parseGitDiff();

		} catch ( err ) {

			logger.error( `Couldn't parse git diff: ${this.sha}`, err );

			res.status( 500 ).send( 'Internal Error: parseGitDiff failed' );

			return false;

		}


		// Step 7:
		// Read uploaded task results
		try {

			await this.readResults();

		} catch ( err ) {

			logger.error( `Couldn't read test results: ${this.sha}`, err );

			res.status( 500 ).send( 'Internal Error: readResults failed' );

			return false;

		}


		// Step 8:
		// Use those results to collect stats
		try {

			this.collectStats();

		} catch ( err ) {

			logger.error( `Aggregators failed, ${this.run.majorErrors} major errors: ${this.sha}`, err );

			res.status( 500 ).send( 'Internal Error: Aggregators failed' );

			return false;

		}

		if ( this.run.majorErrors > 0 ) {

			logger.error( `Found major errors: ${this.run.majorErrors}` );
			// res.status( 500 ).send( `majorErrors detected: ${this.run.majorErrors}` );

			// return false;

		}


		// Step 9:
		// Augment current overview with comparisons to parent and baseline data if available
		try {

			this.calcOverview();

		} catch ( err ) {

			logger.error( `Couldn't calc overview: ${this.sha}`, err );

			res.status( 500 ).send( 'Internal Error: calcOverview failed' );

			return false;

		}


		// TODO: remove
		logger.debug( { results: this.results } );
		logger.debug( { overview: this.stats.overview } );
		logger.debug( { files: this.stats.files } );
		logger.debug( { errors: this.stats.errors } );


		// Step 10:
		// Finalize overview and update run
		try {

			this.saveOverview();

		} catch ( err ) {

			logger.error( `Calculating overview worked, but saving it failed: ${this.sha}, ${Object.entries( this.stats.overview )}`, err );

			res.status( 500 ).send( 'Internal Error: saveOverview failed' );

			return false;

		}


		// Step 11:
		// Save errors
		try {

			this.saveErrors();

		} catch ( err ) {

			logger.error( `Couldn't save errors: ${this.sha}`, err );

			res.status( 500 ).send( 'Internal Error: saveErrors failed' );

			return false;

		}


		// Step 12:
		// Get all 'touched' files for every example file
		try {

			await this.findAllDependencies();

		} catch ( err ) {

			logger.error( `Couldn't find all dependencies: ${this.sha}`, err );

			res.status( 500 ).send( 'Internal Error: findAllDependencies failed' );

			return false;

		}


		// Step 13:
		// Save dependencies tree if no base is available or if this is a base itself
		try {

			this.saveDependencies();

		} catch ( err ) {

			logger.error( `Couldn't save dependencies: ${this.sha}`, err );

			res.status( 500 ).send( 'Internal Error: saveDependencies failed' );

			return false;

		}


		// Step 14:
		// Save results
		try {

			this.saveResults();

		} catch ( err ) {

			logger.error( `Couldn't save results: ${this.sha}`, err );

			res.status( 500 ).send( 'Internal Error: saveResults failed' );

			return false;

		}


		logger.complete( 'Done' );

		this.run.save();

		res.status( 200 ).send( jsonStableStringify( this.allDeps ) );

		return true;

	}


	// read all touched filenames from profiler-results
	static readFilenames( pathParsed, pathPacked ) {

		const parsed = JSON.parse( fs.readFileSync( pathParsed, 'utf8' ) );
		const packed = JSON.parse( fs.readFileSync( pathPacked, 'utf8' ) );

		// FIXME: stop this once every run has a 'local' prop
		const local = ( typeof packed[ 'local' ] !== 'undefined' ) ? packed.local : [];

		const uniq = parsed.uniq;

		const coverage = Object.keys( parsed.lines );

		const shaderChunks = packed.shaderChunks.map( sc => sc.source.replace( /^\./, 'src/renderers/shaders' ) ); // FIXME: hardcoded

		const shaderLibs = Object.values( packed.shaderLibs ).reduce( ( all, cur ) => {

			all.push( cur.fragmentShader.linked.source.replace( /^\./, 'src/renderers/shaders' ) ); // FIXME: hardcoded
			all.push( cur.vertexShader.linked.source.replace( /^\./, 'src/renderers/shaders' ) ); // FIXME: hardcoded

			return all;

		}, [] );

		return [ ...local, ...uniq, ...coverage, ...shaderChunks, ...shaderLibs ].filter( ( name, i, a ) => a.indexOf( name ) === i );

	}

}


// that's all there is for now
const routesRuns = {
	// '/incoming/startRun/:sha': startRun,
	'/incoming/endRun/:sha': 'endRun'
};

// maybe later?
// const routesTasks = {
// '/incoming/startTask/:name': startTask,
// '/incoming/endTask/:name': endTask,
// '/incoming/failTask/:name': failTask
// };

module.exports = {
	routes: Object.entries( routesRuns ).reduce( ( all, [ route, handler ] ) => {

		all[ route ] = async ( req, res ) => {

			if ( ! req.params.sha || /^[a-f0-9]{40}$/i.test( req.params.sha ) !== true ) {

				logger.error( 'Invalid SHA:', req.params.sha );

				res.status( 500 ).send( 'Invalid SHA' );

				return false;

			}

			// TODO: sha in constructor?
			const inc = new Incoming();

			await inc[ handler ]( req, res );

			return true;

		};

		return all;

	}, {} ),

	Incoming
};
