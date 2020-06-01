const path = require( 'path' );
const express = require( 'express' );
const cors = require( 'cors' );

// config.api.ci.*
const config = require( 'rc' )( '3cidev' );

// logging
const { Signale } = require( 'signale' );
const logger = new Signale( { scope: 'API CI', config: { displayTimestamp: true, displayDate: true } } );


// setup HTTP server for incoming API requests
const app = express();
app.use( cors() );

const Database = require( 'better-sqlite3' );
const db = new Database( path.join( config.root, config.api.database ), { fileMustExist: true } );

// import API endpoints
const checks = require( './checks' );
const linters = require( './linters' );
const typesearches = require( './typeSearches' );
const dependencies = require( './dependencies' );
const profilings = require( './profilings' );
const runInfos = require( './runInfos' );
const debug = require( './debug' );

const Run = require( '../helpers/Run' );
const Results = require( '../helpers/Results' );
const Test = require( '../helpers/Test' );
const File = require( '../helpers/File' );

Object.entries( { ...checks, ...linters, ...typesearches, ...dependencies, ...profilings, ...runInfos, ...debug } ).forEach( ( [ route, handler ] ) => {

	logger.log( `Adding route for ${route}...` );

	app.get( route, ( req, res, next ) => {

		logger.debug( 'Route:', route, 'Params:', req.params, 'Query:', req.query );

		return handler( req, res, next );

	} );

} );


// ----------------------------------------------------------------------------------------------------------- //
// Home.vue
// ----------------------------------------------------------------------------------------------------------- //
app.get( '/init', ( req, res ) => {

	const rows = db.prepare( `SELECT runId, sha, timestamp, reason, parentRunId, baselineRunId, majorErrors FROM runs
	LEFT JOIN revisions USING(revisionId)
ORDER BY runId DESC` ).all();

	res.status( 200 ).contentType( 'application/json' ).send( rows );

} );

app.get( '/detailedOverview/:runId/:test', ( req, res ) => {

	if ( /^[0-9]+$/i.test( req.params.runId ) !== true ) {

		logger.error( 'Invalid runId:', req.params.runId );

		res.status( 500 ).send( 'Invalid runId' );

		return false;

	}

	if ( /^[a-z]+$/i.test( req.params.test ) !== true ) {

		logger.error( 'Invalid test:', req.params.test );

		res.status( 500 ).send( 'Invalid test' );

		return false;

	}

	// get the test's id
	let test;
	try {

		test = Test.loadByName( req.params.test );

	} catch ( err ) {

		logger.error( `detailedOverview: Couldn't load test named '${req.params.test}' for #${req.params.runId}` );

		res.status( 500 ).send( `Couldn't load requested test` );

		return false;

	}

	const results = {};

	let run;
	try {

		run = Run.loadByRunId( req.params.runId );

		const _results = Results.reformatToTestBased( run.getResults() )[ test.testId ];

		Object.values( _results ).reduce( ( all, result ) => {

			all[ result.fileId ] = { r: result.value, p: - 1, b: - 1 };

			return all;

		}, results );

	} catch ( err ) {

		logger.error( `detailedOverview: Couldn't load current run and results for #${req.params.runId} -> ${err}` );

		res.status( 500 ).send( `Couldn't load current run` );

		return false;

	}


	if ( run.baselineRun ) {

		try {

			const _results = Results.reformatToTestBased( run.baselineRun.getResults() )[ test.testId ];

			Object.values( _results ).reduce( ( all, result ) => {

				all[ result.fileId ] = all[ result.fileId ] || { b: - 1, p: - 1, r: - 1 };
				all[ result.fileId ].b = result.value;

				return all;

			}, results );

		} catch ( err ) {

			logger.error( `detailedOverview: Couldn't load results for baseline #${run.baselineRunId} of #${req.params.runId}: ${err}` );

			// no failure, keep going - maybe parent run has something useful for us

		}

	}

	if ( run.parentRun ) {

		try {

			const _results = Results.reformatToTestBased( run.parentRun.getResults() )[ test.testId ];

			Object.values( _results ).reduce( ( all, result ) => {

				all[ result.fileId ] = all[ result.fileId ] || { b: - 1, p: - 1, r: - 1 };
				all[ result.fileId ].p = result.value;

				return all;

			}, results );

		} catch ( err ) {

			logger.error( `detailedOverview: Couldn't load results for parent #${run.parentRunId} of #${req.params.runId}: ${err}` );

		}

	}


	if ( Object.keys( results ).length === 0 || Object.values( results ).every( r => r.b === - 1 && r.r === - 1 && r.p === - 1 ) ) {

		// now we give up
		res.status( 500 ).send( `No suitable results could be loaded for #${req.params.runId}` );

		return false;

	}


	// finally: replace ids with filenames
	let namedResults;
	try {

		namedResults = Object.keys( results ).reduce( ( all, id ) => {

			const filename = File.loadByFileId( id ).name;
			all[ filename ] = results[ id ];

			return all;

		}, {} );

	} catch ( err ) {

		logger.error( `detailedOverview: Couldn't load filenames for #${req.params.runId}: ${err}` );

		res.status( 500 ).send( `Failed to load filenames` );

		return false;

	}

	res.status( 200 ).contentType( 'application/json' ).send( namedResults );

	return true;

} );

// ----------------------------------------------------------------------------------------------------------- //


// default route
app.get( '*', ( req, res ) => {

	logger.debug( '/*' );

	res.sendStatus( 404 );

} );


// boilerplate
const port = config.api.ci.port;
const host = config.api.ci.host;

logger.log( `Starting server on ${host}:${port}...` );

app.listen( port, host, () => {

	logger.log( 'Server started' );

	logger.debug( '🔭 Looking for data in all the wrong places... and also:', config.api.ci.jsonPath );

} );


const terminator = function ( sig ) {

	if ( typeof sig === 'string' ) {

		logger.debug( `Received ${sig}` );

		logger.log( 'Server stopped' );

		process.exit( 1 );

	}

};

// every process signal related to exit/quit I hope
[
	'SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT',
	'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM'
].forEach( signal => {

	process.on( signal, () => terminator( signal ) );

} );
