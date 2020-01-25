const fs = require( 'fs' );
const Promise = require( 'bluebird' );
const jsonStableStringify = require( 'json-stable-stringify' );
const nodegit = require( 'nodegit' );
const shell = require( 'shelljs' );
const path = require( 'path' );
const glob = require( 'glob' );


// helpers
// const Dependency = require( './helpers/Dependency' );
const Run = require( './helpers/Run' );
const Revision = require( './helpers/Revision' );
const Overview = require( './helpers/Overview' );
const Test = require( './helpers/Test' );
const File = require( './helpers/File' );


// summing up all errors across all tests,
// hits per files, etc.
const aggregatorOverview = require( './aggregators/overview' );
const aggregatorFiles = require( './aggregators/files' );
const aggregatorErrors = require( './aggregators/errors' );


// config.api.incoming.*
const config = require( 'rc' )( '3cidev' );


// logging
const { Signale } = require( 'signale' );
const logger = new Signale( { scope: 'API Incoming', config: { displayTimestamp: true, displayDate: true } } );


// database interface
const Database = require( 'better-sqlite3' );
const db = new Database( path.join( config.root, config.api.database ), { fileMustExist: true } );


// that's all there is for now
const routesRuns = {
	// '/incoming/startRun/:sha': startRun,
	'/incoming/endRun/:sha': endRun
};

// maybe later?
const routesTasks = {
	// '/incoming/startTask/:name': startTask,
	// '/incoming/endTask/:name': endTask,
	// '/incoming/failTask/:name': failTask
};

module.exports = {
	...Object.entries( routesRuns ).reduce( ( all, [ route, handler ] ) => {

		all[ route ] = async ( req, res ) => {

			if ( ! req.params.sha || /^[a-f0-9]{40}$/i.test( req.params.sha ) !== true ) {

				logger.error( 'Invalid SHA:', req.params.sha );

				res.status( 500 ).send( 'Invalid SHA' );

				return false;

			}

			await handler( req, res );

			return true;

		};

		return all;

	}, {} ),

	...Object.entries( routesTasks ).reduce( ( all, [ route, handler ] ) => {

		all[ route ] = async ( req, res ) => {

			if ( /^[A-Z]+$/i.test( req.params.name ) !== true ) {

				logger.error( 'Invalid task name:', req.params.name );

				res.status( 500 ).send( 'Invalid task name' );

				return false;

			}

			await handler( req, res );

			return true;

		};

		return all;

	}, {} )
};


// active checks
const checks = [
	'checkDocsForBrokenExampleLinks',
	'checkDocsForBrokenExternalLinks',
	'checkNonDocsForBrokenExternalLinks',
	// 'checkNpmForOutdatedDeps',
	// 'checkWithTSCompiler',
	'compareDeclarationsWithDocs',
	'compareDeclarationsWithInstancedObjects',
	'compareDeclarationsWithSource',
	// 'runUnitTests',
	'compareSourceExports',
	'compareExamplesExports'
];

// active linters
const linters = [
	'doobDoc',
	'ESLintCodeTags',
	'ESLintJsFiles',
	'ESLintScriptTags',
	'HTMLLint',
	'ESLintTsFiles',
	'StyleLint'
];

// active dependencies checks
const dependencies = [
	// 'DocsDocsDeps'
];


const sqlInsertResult = db.prepare( 'INSERT OR IGNORE INTO results ( `testId`, `fileId`, `value` ) VALUES ( ?, ?, ? )' );
const sqlSelectResultIdFromTestIdAndFileIdAndValue = db.prepare( 'SELECT resultId FROM results WHERE testId = ? AND fileId = ? AND value = ?' ); // ugh

const sqlCleanRun2Result = db.prepare( 'DELETE FROM runs2results WHERE runId = ?' );
const sqlInsertRun2Result = db.prepare( 'INSERT OR IGNORE INTO runs2results ( `runId`, `resultId` ) VALUES ( ?, ? )' );

const sqlInsertErrorsResult = db.prepare( 'INSERT OR REPLACE INTO errors ( `runId`, `testId`, `value` ) VALUES ( ?, ?, ? )' );
const sqlCleanErrors = db.prepare( 'DELETE FROM errors WHERE runId = ?' );


/**
 * load dependencies, ignoring any delta tree stuff
 * @param {number} revisionId
 * @returns {Object.<string, string[]>}
 */
function loadDependencies( revisionId ) {

	const query = db.prepare( `SELECT dependencies.*, f1.name sourceFile, f2.name dependentFile FROM dependencies
	LEFT JOIN files f1 ON f1.fileId = dependencies.srcFileId
	LEFT JOIN files f2 ON f2.fileId = dependencies.depFileId
	WHERE revisionId = ?` );
	const result = query.all( revisionId );

	if ( ! result || result.length === 0 )
		throw new Error( `Failed to load base dependencies for revisionId '${revisionId}'` );

	return result.reduce( ( all, dep ) => {

		all[ dep.sourceFile ] = all[ dep.sourceFile ] || [];
		all[ dep.sourceFile ].push( dep.dependentFile );

		return all;

	}, {} );

}


/**
 * Create a diff between two sets of dependencies
 * @param {Object.<string, string[]>} baseDependencies
 * @param {Object.<string, string[]>} childDependencies
 * @returns {{ inBaseNotChild: (Object.<string, string[]>|{}), inChildNotBase: (Object.<string, string[]>|{}) }}
 */
function createDependenciesDelta( baseDependencies, childDependencies ) {

	// probably quicker to solve with some Set() logic
	const inBaseNotChild = {};
	const inChildNotBase = {};

	// everything in base but not in child gets NULLed
	Object.keys( baseDependencies ).forEach( srcFile => {

		if ( srcFile in childDependencies === false ) {

			inBaseNotChild[ srcFile ] = baseDependencies[ srcFile ];

		} else {

			const diff = baseDependencies[ srcFile ].filter( d => childDependencies[ srcFile ].includes( d ) === false );
			if ( diff.length > 0 )
				inBaseNotChild[ srcFile ] = diff;

		}

	} );

	// everything in child but not in base gets saved to the database
	Object.keys( childDependencies ).forEach( srcFile => {

		if ( srcFile in baseDependencies === false ) {

			inChildNotBase[ srcFile ] = childDependencies[ srcFile ];

		} else {

			const diff = childDependencies[ srcFile ].filter( d => baseDependencies[ srcFile ].includes( d ) === false );
			if ( diff.length > 0 )
				inChildNotBase[ srcFile ] = diff;

		}

	} );

	return { inBaseNotChild, inChildNotBase };

}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function endRun( req, res ) {

	const sha = req.params.sha;

	// cache
	const threejsGitPath = path.join( config.root, config.threejsRepository );

	// Step 0:
	// Are there actually any test results available? If so, extract them
	const resultFiles = glob.sync( path.join( config.api.ci.jsonPath, '{checks,linters,dependencies}', `*-${sha}.json` ) );
	// const dependenciesArchive = fs.existsSync( path.join( config.api.ci.jsonPath, 'dependencies', `${sha}.tar.gz` ) );
	const dependenciesArchive = true;
	if ( resultFiles.length < ( checks.length + linters.length + dependencies.length ) || dependenciesArchive === false ) {

		logger.error( `endRun called while still missing results: ${resultFiles.length} vs ${( checks.length + linters.length + dependencies.length )} and ${dependenciesArchive}` );
		res.status( 500 ).send( 'Results missing' );
		return false;

	}

	const tarResult = shell.exec( `tar xzf ${sha}.tar.gz`, { silent: true, cwd: path.join( config.api.ci.jsonPath, 'dependencies' ) } );
	if ( tarResult.code !== 0 ) {

		logger.error( `Extraction of ${path.join( config.api.ci.jsonPath, 'dependencies', sha + '.tar.gz' )} failed: ${tarResult.code}` );
		res.status( 500 ).send( 'Extraction failed' );
		return false;

	}


	// Step 1:
	// Create the submitted revision
	const revision = new Revision();
	revision.sha = sha;
	revision.save(); // INSERT OR IGNORE


	// Step 2:
	// Lookup the commit and note delay between committing and finishing CI
	let delay, timestamp;
	try {

		const repository = await nodegit.Repository.open( threejsGitPath );
		const commitDate = ( await repository.getCommit( sha ) ).date();

		timestamp = commitDate.getTime();
		delay = Math.ceil( ( new Date() - commitDate ) / 1000 );

	} catch ( err ) {

		logger.error( `Couldn't access base repository / fetch the commit: ${sha}`, err );
		res.status( 500 ).send( 'Internal Error: Commit not found' );
		return false;

	}


	// Step 3:
	// Create the skeleton run object or load an existing one
	let run;

	try {

		run = Run.loadByRevisionId( revision.revisionId );

	} catch ( err ) {

		// failed to find a run?
		run = new Run();

		run.revisionId = revision.revisionId;
		run.overview = null;

		run.reason = 'CI';
		run.dependenciesChanged = '';
		run.machineId = 1;
		run.majorErrors = 0;

	}

	// Update these no matter if we found a pre-existing run
	run.timestamp = timestamp;
	run.delayAfterCommit = delay;

	run.save();


	// Step 4:
	// Find the baseline commit...
	let baseSha;
	try {

		baseSha = shell.exec(
			`git rev-parse "${sha}^^{/(Updated builds.|r1[0-9][0-9])}"`,
			{ cwd: threejsGitPath, encoding: 'utf8', silent: true }
		);

	} catch ( err ) {

		logger.error( `Couldn't find base commit, saving in full: ${sha}, ${baseSha.code || 'no code'}, ${baseSha.stderr || 'no stderr'}` );

	}

	// ...and set its run as baselineRunId
	if ( baseSha ) {	// Note: case "! baseSha" will be handled later

		baseSha = baseSha.stdout.trim();

		logger.log( `Base SHA for ${sha}: ${baseSha}` );

		const baseRev = new Revision();
		baseRev.sha = baseSha;
		baseRev.save(); // save is INSERT OR IGNORE for revision

		try {

			run.baselineRun = Run.loadByRevisionId( baseRev.revisionId );

		} catch ( err ) {

			logger.error( `Couldn't load baseline run: ${err}` );
			run.baselineRun = null;

		}

	}


	// Step 5:
	// Find the parent commit...
	let parentSha;
	try {

		parentSha = shell.exec(
			`git rev-parse "${sha}^"`,
			{ cwd: threejsGitPath, encoding: 'utf8', silent: true }
		);

	} catch ( err ) {

		logger.error( `Couldn't find parent commit: ${sha}, ${parentSha.code || 'no code'}, ${parentSha.stderr || 'no stderr'}` );

	}

	// ...and set its run as parentRunId
	if ( parentSha ) {	// Note: case "! parentSha" will NOT be handled later, we just leave it at NULL

		parentSha = parentSha.stdout.trim();

		logger.log( `Parent SHA for ${sha}: ${parentSha}` );

		const parentRev = new Revision();
		parentRev.sha = parentSha;
		parentRev.save(); // save is INSERT OR IGNORE for revision

		try {

			run.parentRun = Run.loadByRevisionId( parentRev.revisionId );

		} catch ( err ) {

			logger.error( `Couldn't load parent run: ${err}` );
			run.parentRun = null;

		}

	}


	// Step 6:
	// Read uploaded task results
	// TODO: error handling
	const checkResults = await Promise.props( checks.reduce( ( results, check ) => {

		results[ check ] = fs.promises.readFile( `${config.root}/checks/${check}-${sha}.json`, 'utf8' )
			.then( json => JSON.parse( json ) );

		return results;

	}, {} ) );

	const linterResults = await Promise.props( linters.reduce( ( results, linter ) => {

		results[ linter ] = fs.promises.readFile( `${config.root}/linters/${linter}-${sha}.json`, 'utf8' )
			.then( json => JSON.parse( json ) );

		return results;

	}, {} ) );

	const dependenciesResults = await Promise.props( dependencies.reduce( ( results, dep ) => {

		results[ dep ] = fs.promises.readFile( `${config.root}/dependencies/${dep}-${sha}.json`, 'utf8' )
			.then( json => JSON.parse( json ) );

		return results;

	}, {} ) );


	// Step 7:
	// Use those results to collect stats:

	// count major errors
	const majorErrors = Object.entries( checkResults ).concat(
		Object.entries( linterResults ),
		Object.entries( dependenciesResults ) ).reduce( ( totalSum, [ test, results ] ) => {

		// TODO: { js: errors, dts: errors } etc. need additional logic
		if ( ! results.errors || results.errors.length === 0 ) {

			logger.debug( `No errors on ${test}` );

		} else {

			logger.warn( `${results.errors.length} majorErrors on ${test}:`, results.errors );

			totalSum += results.errors.length;

		}

		return totalSum;

	}, 0 );

	if ( majorErrors > 0 ) {

		logger.fatal( `majorErrors: ${majorErrors}` );
		res.status( 500 ).send( `majorErrors detected: ${majorErrors}` );

	}

	run.majorErrors = ( majorErrors === - 1 ) ? 0 : majorErrors;
	run.save();

	// count total hits per test
	// TODO: turn into objects
	const overview = aggregatorOverview( checks, checkResults, linters, linterResults, dependencies, dependenciesResults );

	// count hits per file
	const files = aggregatorFiles( checks, checkResults, linters, linterResults, dependencies, dependenciesResults );

	// count errors per test
	const errors = aggregatorErrors( checks, checkResults, linters, linterResults, dependencies, dependenciesResults );


	// Step 8:
	// Augment current overview with comparisons to parent and baseline data if available
	const baselineOverview = ( run.baselineRunId ) ? Overview.loadByRunId( run.baselineRunId ) : new Overview();
	const parentOverview = ( run.parentRunId ) ? Overview.loadByRunId( run.parentRunId ) : new Overview();

	for ( const key of Object.keys( overview ) ) {

		if ( parentOverview.overviewJson[ key ] && 'result' in parentOverview.overviewJson[ key ] ) {

			overview[ key ].parent = parentOverview.overviewJson[ key ].result;
			overview[ key ].parentDelta = 1 - parentOverview.overviewJson[ key ].result / overview[ key ].result;

		} else {

			logger.warn( `${key} missing from parent's overview` );

		}

		if ( baselineOverview.overviewJson[ key ] && 'result' in baselineOverview.overviewJson[ key ] ) {

			overview[ key ].baseline = baselineOverview.overviewJson[ key ].result;
			overview[ key ].baselineDelta = 1 - baselineOverview.overviewJson[ key ].result / overview[ key ].result;

		} else {

			logger.warn( `${key} missing from baseline's overview` );

		}

	}


	// TODO: remove
	console.log( { overview } );
	console.log( { files } );
	console.log( { errors } );
	console.log( { majorErrors } );


	// Step 9:
	// Finalize overview and update run
	const overviewObj = new Overview();
	overviewObj.overviewJson = jsonStableStringify( overview );
	overviewObj.save();
	run.overviewId = overviewObj.overviewId;
	run.save();


	// Step 10:
	// Save results
	sqlCleanRun2Result.run( run.runId );

	logger.log( 'Adding tests...' );

	for ( const testName in files ) {

		logger.debug( 'Test:', testName );

		const test = Test.loadByName( testName );

		logger.debug( 'TestId:', test.testId );

		for ( const file in files[ testName ].files ) {

			// otherwise we have files like 'api/en/objects/Object3d' plus 'docs/api/en/objects/Object3d.html' (e.g.)
			// FIXME: normalize names when they're first logged
			const fullFile = ( file.startsWith( 'api/' ) === true && file.endsWith( '.html' ) === false ) ? `docs/${file}.html` : file;

			const fileObj = new File();
			fileObj.name = fullFile;
			fileObj.save();

			const value = files[ testName ].files[ file ];

			sqlInsertResult.run( test.testId, fileObj.fileId, value );
			const resultId = sqlSelectResultIdFromTestIdAndFileIdAndValue.get( test.testId, fileObj.fileId, value ).resultId;

			sqlInsertRun2Result.run( run.runId, resultId );

		}

	}


	// Step 11:
	// Save errors
	logger.log( 'Cleaning errors...' );

	sqlCleanErrors.run( run.runId );

	for ( const testName in errors ) {

		logger.debug( 'Test:', testName );

		const test = Test.loadByName( testName );

		logger.debug( 'TestId:', test.testId );

		sqlInsertErrorsResult.run( run.runId, test.testId, errors[ testName ] );

		logger.debug( `Errors: ${errors[ testName ]}` );

	}


	// Step 12:
	// Save dependencies tree (or delta)
	if ( ! baseSha || ! run.baselineRun ) { // no baseline? -> save everything

		for ( const file of glob.sync( path.join( config.api.ci.jsonPath, 'dependencies', `*_parsed-${sha}.json` ) ) ) {

			const ex = path.basename( file )
				.replace( 'examples_', 'examples/' )
				.replace( `_parsed-${sha}.json`, '.html' );

			const rev = new Revision();
			rev.sha = sha;
			rev.save(); // INSERT OR IGNORE

			declareAllFilesDependencies( rev.revisionId, ex, file, file.replace( '_parsed', '_packed' ) );

		}

	} else { // baseline exists -> save delta

		const baseDependencies = loadDependencies( run.baselineRun.revisionId );

		const childDependencies = glob.sync( path.join( config.api.ci.jsonPath, 'dependencies', `*_parsed-${sha}.json` ) ).reduce( ( all, file ) => {

			const ex = path.basename( file )
				.replace( 'examples_', 'examples/' )
				.replace( `_parsed-${sha}.json`, '.html' );

			const rev = new Revision();
			rev.sha = sha;
			rev.save();

			const filenames = readFilenames( file, file.replace( '_parsed', '_packed' ) );

			if ( filenames.length > 0 )
				all[ ex ] = filenames;

			return all;

		}, {} );

		const delta = createDependenciesDelta( baseDependencies, childDependencies );

		console.log( delta );

		const queryNull = db.prepare( 'INSERT OR IGNORE INTO dependencies (revisionId, srcFileId, depFileId, value) VALUES( ?, ?, ?, NULL )' );

		// NULL all in-base-but-not-in-child dependencies
		Object.keys( delta.inBaseNotChild ).forEach( srcFile => {

			const source = File.loadByName( srcFile );

			delta.inBaseNotChild[ srcFile ].forEach( depFile => {

				const dependency = File.loadByName( depFile );

				queryNull.run( run.revisionId, source.fileId, dependency.fileId );

			} );

		} );

		const queryAdd = db.prepare( 'INSERT OR IGNORE INTO dependencies (revisionId, srcFileId, depFileId, value ) VALUES ( ?, ?, ?, 1 )' );

		// add only in-child-but-not-in-base dependencies
		Object.keys( delta.inChildNotBase ).forEach( srcFile => {

			const source = File.loadByName( srcFile );

			delta.inChildNotBase[ srcFile ].forEach( depFile => {

				const dependency = File.loadByName( depFile );

				queryAdd.run( run.revisionId, source.fileId, dependency.fileId );

			} );

		} );

	}

}


// this is all bound to be thrown out once API & Dependencies is finalized
// TODO: external files in PARSED.external


// read all touched filenames from profiler-results
function readFilenames( pathParsed, pathPacked ) {

	const parsed = JSON.parse( fs.readFileSync( pathParsed, 'utf8' ) );
	const packed = JSON.parse( fs.readFileSync( pathPacked, 'utf8' ) );

	const uniq = parsed.uniq;

	const shaderChunks = packed.shaderChunks.map( sc => sc.source.replace( /^\./, 'src/renderers/shaders' ) ); // FIXME: hardcoded

	const shaderLibs = Object.values( packed.shaderLibs ).reduce( ( all, cur ) => {

		all.push( cur.fragmentShader.linked.source.replace( /^\./, 'src/renderers/shaders' ) ); // FIXME: hardcoded
		all.push( cur.vertexShader.linked.source.replace( /^\./, 'src/renderers/shaders' ) ); // FIXME: hardcoded

		return all;

	}, [] );

	return [ ...uniq, ...shaderChunks, ...shaderLibs ].filter( ( name, i, a ) => a.indexOf( name ) === i );

}

/**
 * Mass-insert all files referenced in an example's
 * results and set them up as dependecies
 * @param {number} revisionId
 * @param {string} sourceFile Relative path of the example used
 * @param {string} pathParsed Path to the examples_*_parsed.json file
 * @param {string} pathPacked Path to the examples_*_packed.json file
 */
function declareAllFilesDependencies( revisionId, sourceFile, pathParsed, pathPacked ) {

	const filenames = readFilenames( pathParsed, pathPacked );

	for ( const filename of filenames ) {

		const file = new File();
		file.name = filename;
		file.save();

	}

	const file = new File();
	file.name = sourceFile;
	file.save();

	const srcFileId = file.fileId;

	const sqlInsertDependency = db.prepare( `INSERT OR IGNORE INTO dependencies (revisionId, srcFileId, depFileId, value)
	VALUES ( $revisionId, $srcFileId, (SELECT fileId FROM files WHERE name = $depFilename), 1 );` );

	const bulkInsert = db.transaction( deps => {

		for ( const dep of deps ) {

			sqlInsertDependency.run( {
				revisionId,
				srcFileId,
				depFilename: dep
			} );

		}

	} );

	bulkInsert( filenames );

}
