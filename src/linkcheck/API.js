// for the actual API server itself
const express = require( 'express' );
const cors = require( 'cors' );

// init config...
const config = require( 'rc' )( '3cidev' );

// logging
const { Signale } = require( 'signale' );
const logger = new Signale( { scope: 'linkcheck API', config: { displayTimestamp: true, displayDate: true } } );


// setup HTTP server for incoming API requests
const app = express();
app.use( cors() );
app.use( express.json() ); // application/json


// main cache
const ONE_HOUR = 1000 * 60 * 60;
const ONE_DAY = ONE_HOUR * 24;
const Cache = require( 'timed-cache' );
const responseCache = new Cache( { defaultTtl: ONE_DAY } ); // 24 hours

// url checking
const checkLinks = require( 'check-links' );


// "auth"
const TOKEN = config.api.linkcheck.token || process.env.LINKCHECK_TOKEN;
if ( ! TOKEN ) {

	logger.fatal( 'No token set' );
	process.exit( - 1 );

}


app.post( '/check', ( req, res ) => {

	// logger.debug( '/check', req.body );

	const { token, url } = req.body;

	if ( ! token || ! url ) {

		logger.error( `Missing token or url from ${req}` );

		res.status( 400 ).send( 'Missing parameter' );

		return false;

	}


	if ( token !== TOKEN ) {

		logger.error( `Invalid token: ${token} for ${url} from ${req}` );

		res.status( 401 ).send( 'Bad token' );

		return false;

	}


	if ( /^https?:\/\//i.test( url ) !== true ) {

		logger.error( `Invalid url: ${url} from ${req}` );

		res.status( 400 ).send( 'Bad url' );

		return false;

	}


	const cachedResponse = responseCache.get( url );

	if ( cachedResponse === true ) {

		logger.success( `${url} in cache and positive` );

		res.status( 200 ).contentType( 'application/json' ).send( { url, result: true } );

		return true;

	} else if ( cachedResponse === false ) {

		logger.log( `${url} in cache and negative` );

		res.status( 404 ).contentType( 'application/json' ).send( { url, result: false } );

		return false;

	} else {

		logger.debug( `${url} not in cache or invalid entry: ${cachedResponse}` );

	}


	return _recheckOnEviction( url )
		.then( result => res.status( result ? 200 : 404 ).contentType( 'application/json' ).send( { url, result } ) )
		.catch( err => {

			logger.fatal( `URL check for ${url} failed: ${err}` );

			res.status( 500 ).send( 'Unknown error' );

			return false;

		} );

} );


function _checkUrl( url ) {

	return checkLinks( [ url ], {
		concurrency: 1,
		timeout: 30000,
		retry: 1
	} )
		.then( resp => {

			if ( resp[ url ] ) {

				return resp[ url ].status === 'alive';

			} else {

				return false;

			}

		} );

}


async function _recheckOnEviction( key/* , value */ ) {

	const alive = await _checkUrl( key );

	if ( alive === true )
		logger.success( `URL ${key} is positive` );
	else
		logger.warn( `URL ${key} is negative: ${alive}` );

	responseCache.put( key, alive, {
		ttl: ONE_DAY + Math.random() * 10 * ONE_HOUR, // 24 hours + random() hours * 10
		callback: async function ( url, status ) {

			await _recheckOnEviction( url, status );

		  }
	} );

	return !! alive;

}


// default route
app.get( '*', ( req, res ) => {

	logger.debug( '/*' );

	res.sendStatus( 404 );

} );

const port = config.api.linkcheck.port;
const host = config.api.linkcheck.host;

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
