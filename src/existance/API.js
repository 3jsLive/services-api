const path = require( 'path' );

// for the actual API server itself
const express = require( 'express' );
const cors = require( 'cors' );

// access to the DB
const Database = require( 'better-sqlite3' );

// init config...
const config = require( 'rc' )( '3cidev' );

// ...and extend
config.api.existance.databaseFile = path.join( config.root, config.api.database );

// logging
const { Signale } = require( 'signale' );
const logger = new Signale( { scope: 'existance API', config: { displayTimestamp: true, displayDate: true } } );


// setup HTTP server for incoming API requests
const app = express();
app.use( cors() );


// database of commits
const db = new Database( config.api.existance.databaseFile, { fileMustExist: true } );


app.get( '/sha/:sha', ( req, res ) => {

	logger.debug( '/sha/:sha', req.params );

	if ( /^[a-f0-9]{40}$/i.test( req.params.sha ) !== true ) {

		logger.error( 'Invalid SHA:', req.params.sha );

		res.status( 500 ).send( 'Invalid SHA' );

		return false;

	}

	const sha = req.params.sha;

	const currentState = db.prepare( `SELECT sha FROM revisions WHERE sha = ? LIMIT 1` ).get( sha );
	if ( currentState && 'sha' in currentState && currentState.sha === sha ) {

		logger.log( `SHA ${sha} already exists` );

		res.status( 200 ).contentType( 'applicatioon/json' ).send( JSON.stringify( { exists: true } ) );

		return true;

	} else {

		logger.log( `SHA ${sha} not found` );

		res.status( 200 ).contentType( 'application/json' ).send( JSON.stringify( { exists: false } ) );

		return true;

	}

} );


// default route
app.get( '*', ( req, res ) => {

	logger.debug( '/*' );

	res.sendStatus( 404 );

} );

const port = config.api.existance.port;
const host = config.api.existance.host;

logger.log( `Starting server on ${host}:${port}...` );

app.listen( port, host, () => logger.log( 'Server started' ) );


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
