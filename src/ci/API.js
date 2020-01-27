const fs = require( 'fs' );
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
// const dependencies = require( './dependencies' );
// const profilings = require( './profilings' );
const runInfos = require( './runInfos' ); TODO:

Object.entries( { ...checks, ...linters, ...typesearches, /* ...dependencies, ...profilings, */...runInfos } ).forEach( ( [ route, handler ] ) => {

	logger.log( `Adding route for ${route}...` );

	app.get( route, ( req, res, next ) => {

		logger.debug( 'Route:', route, 'Params:', req.params, 'Query:', req.query );

		return handler( req, res, next );

	} );

} );


// ----------------------------------------------------------------------------------------------------------- //
// faulty dependencies detection for docs-docs connections
// ----------------------------------------------------------------------------------------------------------- //
app.get( '/depsDocsDocs/showFile/:sha', ( req, res ) => {

	if ( /^[a-f0-9]{40}$/i.test( req.params.sha ) !== true ) {

		logger.error( 'Invalid SHA:', req.params.sha );

		res.status( 500 ).send( 'Invalid SHA' );

		return false;

	}

	const content = fs.readFileSync( `${config.jsonPath}${req.params.sha}-DocsDocsDeps.json`, 'utf8' );

	res.status( 200 ).contentType( 'application/json' ).send( content );

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

	const { baselineRunId, parentRunId } = db.prepare( 'SELECT baselineRunid, parentRunId FROM runs WHERE runId = ?' ).get( req.params.runId );

	const rows = db.prepare( `SELECT runId, tests.name, results.value, files.name name
		FROM runs2results
		LEFT JOIN results USING(resultId)
		LEFT JOIN tests USING(testId)
		LEFT JOIN files USING(fileId)
		WHERE runId IN (?, ?, ?) AND tests.name = ?` ).all( req.params.runId, baselineRunId, parentRunId, req.params.test );

	res.status( 200 ).contentType( 'application/json' ).send( {
		baselineRunId, parentRunId, rows
	} );

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
