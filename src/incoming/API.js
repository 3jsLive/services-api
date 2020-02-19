const express = require( 'express' );
const cors = require( 'cors' );

// config.api.ci.*
const config = require( 'rc' )( '3cidev' );

// logging
const { Signale } = require( 'signale' );
const logger = new Signale( { scope: 'API Incoming', config: { displayTimestamp: true, displayDate: true } } );

// setup HTTP server for incoming API requests
const app = express();
app.use( cors() );


// import API endpoints
const incoming = require( './incoming' );

Object.entries( incoming.routes ).forEach( ( [ route, handler ] ) => {

	logger.log( `Adding route for ${route}...` );

	app.get( route, ( req, res, next ) => {

		logger.debug( 'Route:', route, 'Params:', req.params, 'Query:', req.query );

		return handler( req, res, next );

	} );

} );


// ----------------------------------------------------------------------------------------------------------- //


// default route
app.get( '*', ( req, res ) => {

	logger.debug( '/*' );

	res.sendStatus( 404 );

} );


// boilerplate
const port = config.api.incoming.port;
const host = config.api.incoming.host;

logger.log( `Starting server on ${host}:${port}...` );

app.listen( port, host, () => {

	logger.log( 'Server started' );

} );


const terminator = function ( sig ) {

	if ( typeof sig === 'string' ) {

		logger.debug( `Received ${sig}` );

		logger.log( 'Server stopped' );

		process.exit( 1 );

	}

};

[
	'SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT',
	'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM'
].forEach( signal => {

	process.on( signal, () => terminator( signal ) );

} );
