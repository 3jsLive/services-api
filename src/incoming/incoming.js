const fs = require( 'fs' );
const Promise = require( 'bluebird' );
const jsonStableStringify = require( 'json-stable-stringify' );
const nodegit = require( 'nodegit' );
const shell = require( 'shelljs' );
const path = require( 'path' );
const glob = require( 'glob' );
const { getBase, getParent, isBase } = require( '../helpers/History' );


// helpers
// const Dependency = require( '../helpers/Dependency' );
const Run = require( '../helpers/Run' );
const Revision = require( '../helpers/Revision' );
const Overview = require( '../helpers/Overview' );
const Test = require( '../helpers/Test' );
const File = require( '../helpers/File' );


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

			await handler( req, res );

			return true;

		};

		return all;

	}, {} ),

	endRun,
	readFilenames,
	_readResults
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
	'runUnitTests',
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
	'DocsDocsDeps'
];

// active profiling
const profiling = [
	'ProfConsole'
];


const sqlInsertResult = db.prepare( 'INSERT OR IGNORE INTO results ( `testId`, `fileId`, `value` ) VALUES ( ?, ?, ? )' );
const sqlSelectResultIdFromTestIdAndFileIdAndValue = db.prepare( 'SELECT resultId FROM results WHERE testId = ? AND fileId = ? AND value = ?' ); // ugh

const sqlInsertRun2Result = db.prepare( 'INSERT OR IGNORE INTO runs2results ( `runId`, `resultId` ) VALUES ( ?, ? )' );

const sqlInsertErrorsResult = db.prepare( 'INSERT OR REPLACE INTO errors ( `runId`, `testId`, `value` ) VALUES ( ?, ?, ? )' );


/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function endRun( req, res ) {

	const sha = req.params.sha;

	// cache
	const threejsGitPath = path.join( config.root, config.threejsRepository );
	const defaultExecOptions = { cwd: threejsGitPath, encoding: 'utf8', silent: true };


	// Step 0:
	// Are there actually any test results available? If so, extract them
	const resultFiles = glob.sync( path.join( config.api.ci.jsonPath, '{checks,linters,dependencies,profiles}', `*-${sha}.json` ) );
	// const dependenciesArchive = fs.existsSync( path.join( config.api.ci.jsonPath, 'dependencies', `${sha}.tar.gz` ) );
	const dependenciesArchive = true;
	const shouldBeLength = checks.length + linters.length + dependencies.length + profiling.length;
	if ( resultFiles.length < shouldBeLength || dependenciesArchive === false ) {

		logger.error( `endRun called while still missing results: ${resultFiles.length} vs ${shouldBeLength} and ${dependenciesArchive}` );
		res.status( 500 ).send( 'Results missing' );
		return false;

	}

	const tarResult = shell.exec( `tar xzf ${sha}.tar.gz`, { ...defaultExecOptions, cwd: path.join( config.api.ci.jsonPath, 'dependencies' ) } );
	if ( tarResult.code !== 0 ) {

		logger.error( `Extraction of ${path.join( config.api.ci.jsonPath, 'dependencies', sha + '.tar.gz' )} failed: ${tarResult.code} ${tarResult.stdout} ${tarResult.stderr}` );
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

		run.revision = revision;
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

		baseSha = getBase( sha, defaultExecOptions.cwd );

	} catch ( err ) {

		logger.error( `Couldn't find base commit, saving in full: ${sha} ${err}` );

	}

	// ...and set its run as baselineRunId
	if ( baseSha !== null ) {	// Note: case "! baseSha" will be handled later

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

		parentSha = getParent( sha, defaultExecOptions.cwd );

	} catch ( err ) {

		logger.error( `Couldn't find parent commit: ${sha} ${err}` );

	}

	// ...and set its run as parentRunId
	if ( parentSha ) {	// Note: case "! parentSha" will NOT be handled later, we just leave it at NULL

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
	// TODO: uncouple profiling from dependencies
	const checkResults = await Promise.props( checks.reduce( _readResults( sha, 'checks' ), {} ) );
	const linterResults = await Promise.props( linters.reduce( _readResults( sha, 'linters' ), {} ) );
	const dependenciesResults = await Promise.props( dependencies.reduce( _readResults( sha, 'dependencies' ), {} ) );
	const profilingResults = await Promise.props( profiling.reduce( _readResults( sha, 'profiles' ), {} ) );


	// Step 7:
	// Use those results to collect stats:

	// count major errors
	const majorErrors = Object.entries( checkResults ).concat(
		Object.entries( linterResults ),
		Object.entries( dependenciesResults ),
		Object.entries( profilingResults ) ).reduce( ( totalSum, [ test, results ] ) => {

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
	const overview = aggregatorOverview( checks, checkResults, linters, linterResults, dependencies, dependenciesResults, profiling, profilingResults );

	// count hits per file
	const files = aggregatorFiles( checks, checkResults, linters, linterResults, dependencies, dependenciesResults, profiling, profilingResults );

	// count errors per test
	const errors = aggregatorErrors( checks, checkResults, linters, linterResults, dependencies, dependenciesResults, profiling, profilingResults );


	// Step 8:
	// Augment current overview with comparisons to parent and baseline data if available
	const baselineOverview = run.baselineRun.overview || new Overview();
	const parentOverview = run.parentRun.overview || new Overview();

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
	run.overview = overviewObj;
	run.save();


	// Step 10:
	// Save results
	run.cleanResults();

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

	run.cleanErrors();

	for ( const testName in errors ) {

		logger.debug( 'Test:', testName );

		const test = Test.loadByName( testName );

		logger.debug( 'TestId:', test.testId );

		sqlInsertErrorsResult.run( run.runId, test.testId, errors[ testName ] );

		logger.debug( `Errors: ${errors[ testName ]}` );

	}


	// Step 12:
	// Get all 'touched' files
	const allResults = glob.sync( path.join( config.api.ci.jsonPath, 'dependencies', `*_parsed-${sha}.json` ) );
	const allDeps = allResults.reduce( ( all, file ) => {

		const ex = path.basename( file )
			.replace( 'examples_', 'examples/' )
			.replace( `_parsed-${sha}.json`, '.html' );

		const deps = readFilenames( file, file.replace( '_parsed', '_packed' ) );

		if ( deps.length > 0 )
			all[ ex ] = deps;
		return all;

	}, {} );


	// Step 13:
	// Save dependencies tree if no base is available or if this is a base itself
	// one last check to see if maybe *this* is a base commit
	const isThisBase = ( ! baseSha || ! run.baselineRun || isBase( sha, defaultExecOptions.cwd ) );

	if ( isThisBase === false ) {

		// drop deleted files from dependencies
		const delQuery = shell.exec( `git show ${sha} --name-status --oneline`, defaultExecOptions );
		if ( delQuery.code !== 0 ) {

			logger.error( `Couldn't determine deleted files for ${sha}: ${delQuery.code} ${delQuery.stderr}` );

			res.status( 500 ).send( `Couldn't determine deleted files for ${sha}` );

			throw new Error( `Couldn't determine deleted files for ${sha}` );

		}

		delQuery.stdout
			.split( /\n/g )										// split output into lines
			.filter( line => /^D\s+/.test( line ) )				// filter for lines like 'D	foo'
			.map( line => line.replace( /^D\s+/, '' ) )			// cut those lines down to name
			.forEach( del => allDeps[ del ] = null );			// and set them to 'deleted' in the dependencies

	}

	run.saveDependencies( allDeps, isThisBase );

	res.status( 200 ).send( jsonStableStringify( allDeps ) );

}


// read all touched filenames from profiler-results
function readFilenames( pathParsed, pathPacked ) {

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

function _readResults( sha, category ) {

	return ( results, entry ) => {

		results[ entry ] = fs.promises.readFile( path.join( config.api.ci.jsonPath, category, `${entry}-${sha}.json` ), 'utf8' )
			.then( json => JSON.parse( json ) )
			.catch( err => {

				logger.fatal( err );

				throw err;

			} );

		return results;

	};

}
