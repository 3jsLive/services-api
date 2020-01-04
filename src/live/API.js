const fs = require( 'fs' );
const path = require( 'path' );

// in case we need to send a HTTPS request to GitHub's API (trying to avoid importing request or similar)
const https = require( 'https' );

// access to gold repository
const nodegit = require( 'nodegit' );

// for the actual API server itself
const express = require( 'express' );
const cors = require( 'cors' );

// access to the watchers' DB
const Database = require( 'better-sqlite3' );

// init config...
const config = require( 'rc' )( '3cidev' );

// ...and extend
config.api.live.databaseFile = path.join( config.root, config.watchers.dataPath, config.watchers.databases.live );
config.api.live.goldRepository = path.join( config.root, config.threejsRepository, '.git' );


// setup HTTP server for incoming API requests
const app = express();
app.use( cors() );


// database of PRs and commits we're keeping track of
const db = new Database( config.api.live.databaseFile, { fileMustExist: true } );


// for custom git queries
let repo;
( async() => {

	repo = await nodegit.Repository.open( config.api.live.goldRepository );

} )();


// TODO: dead code?
async function getMergebase( ref ) {

	if ( /^[a-f0-9]{40}$/i.test( ref ) === true ) {

		console.log( 'REF seems to be a hash:', ref );

		const devHead = await repo.getReferenceCommit( 'mrdoob/dev' );
		console.log( { devHead } );

		const refCommit = await repo.getCommit( ref );
		console.log( { refCommit } );

		const base = await nodegit.Merge.base( repo, devHead, refCommit );
		console.log( { base } );

		return base;

	} else if ( Number.isInteger( ref ) === true || /^[1-9][0-9]{0,5}$/.test( ref ) === true ) {

		console.log( 'REF seems to be a PR number:', ref );

		const devHead = await repo.getReferenceCommit( 'mrdoob/dev' );
		console.log( { devHead } );

		const prHead = await repo.getReferenceCommit( 'mrdoob/pr/' + ref );
		console.log( { prHead } );

		const base = await nodegit.Merge.base( repo, devHead, prHead );
		console.log( { base } );

		return base;

	} else {

		console.error( 'Unknown ref:', ref );

		return;

	}

}


app.get( '/mergebase/:ref', async ( req, res ) => {

	const base = await getMergebase( req.params.ref );

	if ( base )
		res.status( 200 ).contentType( 'application/json' ).send( JSON.stringify( base.tostrS() ) );
	else
		res.status( 500 ).send( 'Invalid ref: ' + req.params.ref );

	return !! base;

} );


app.get( '/pullrequests', async ( req, res ) => {

	const state = ( req.query[ 'state' ] ) ? req.query[ 'state' ].split( ',' ) : [ 'open' ];

	const prs = db.prepare( `SELECT pullrequests.*, JSON_GROUP_ARRAY(commits.sha) commits
	FROM pullrequests
	LEFT JOIN commits ON commits.ref = ( 'pr/' || pullrequests.number )
	WHERE pullrequests.state IN ( ${state.map( () => '?' ).join( ',' )} )
	GROUP BY pullrequests.number
	ORDER BY pullrequests.number` ).all( state );

	prs.forEach( ( pr, index ) => prs[ index ].commits = JSON.parse( pr.commits ) );

	res.status( 200 ).contentType( 'application/json' ).send( prs );

	return true;

} );


app.get( '/commits', async ( req, res ) => {

	const commits = db.prepare( `SELECT
		JSON_GROUP_OBJECT( sha, JSON_OBJECT( 'author', author, 'message', message, 'timestamp', authored_at, 'state', state ) ) AS commits
		FROM commits
		WHERE 1` ).get();

	// commits.forEach( ( c, index ) => commits[ index ] = JSON.parse( c.commit ) );
	res.status( 200 ).contentType( 'application/json' ).send( JSON.parse( commits.commits ) );

	return true;

} );


app.get( '/error/:sha', ( req, res ) => {

	if ( /^[a-f0-9]{40}$/i.test( req.params.sha ) !== true ) {

		console.error( 'Invalid SHA:', req.params.sha );

		res.status( 500 ).send( 'Invalid SHA' );

		return false;

	}

	const currentState = db.prepare( `SELECT state FROM commits WHERE sha = ? LIMIT 1` ).get( req.params.sha );
	if ( currentState.state && currentState.state === 'uploaded' ) {

		console.log( 'Allegedly erroneous SHA', req.params.sha, 'is already uploaded' );
		res.status( 200 ).send( '' );
		return true;

	}

	if (
		fs.existsSync( path.join( config.api.live.buildsPath, req.params.sha + '.js' ) ) === false ||
		fs.existsSync( path.join( config.api.live.buildsPath, req.params.sha + '.min.js' ) ) === false ||
		fs.existsSync( path.join( config.api.live.buildsPath, req.params.sha + '.module.js' ) ) === false ) {

		console.log( 'Files are indeed missing for', req.params.sha );

		db.prepare( 'UPDATE commits SET state = "error" WHERE sha = ?' ).run( req.params.sha );

		console.log( 'noted.' );

		res.status( 200 ).send( '' );

		return true;

	} else {

		console.log( 'Why the error request, all files exist?' );

		res.status( 200 ).send( '' );

		return true;

	}

} );


app.get( '/incoming/:sha', ( req, res ) => {

	if ( /^[a-f0-9]{40}$/i.test( req.params.sha ) !== true ) {

		console.error( 'Invalid SHA:', req.params.sha );

		res.status( 500 ).send( 'Invalid SHA' );

		return false;

	}

	const preExisting = db.prepare( `SELECT sha FROM commits WHERE sha = ? LIMIT 1` ).all( req.params.sha );
	if ( preExisting.length > 0 ) {

		console.log( 'Incoming SHA', req.params.sha, 'already known' );
		res.status( 200 ).send( '' );
		return true;

	}

	if (
		fs.existsSync( path.join( config.api.live.buildsPath, req.params.sha + '.js' ) ) === true &&
		fs.existsSync( path.join( config.api.live.buildsPath, req.params.sha + '.min.js' ) ) === true &&
		fs.existsSync( path.join( config.api.live.buildsPath, req.params.sha + '.module.js' ) ) === true ) {

		const options = {
			hostname: 'api.github.com',
			path: '/repos/mrdoob/three.js/git/commits/' + req.params.sha,
			headers: {
				'User-Agent': '@3jslive'
			}
		};

		https.get( options, ( apiRes ) => {

			const { statusCode } = apiRes;
			const contentType = apiRes.headers[ 'content-type' ];

			let error;
			if ( statusCode !== 200 ) {

				error = new Error( `Request Failed.\nStatus Code: ${statusCode}` );

			} else if ( ! /^application\/json/.test( contentType ) ) {

				error = new Error( `Invalid content-type.\nExpected application/json but received ${contentType}` );

			}

			if ( error ) {

				console.error( error.message, apiRes );

				// consume response data to free up memory
				apiRes.resume();

				res.status( 500 ).send( error.message );

				return;

			}

			apiRes.setEncoding( 'utf8' );

			let rawData = '';
			apiRes.on( 'data', ( chunk ) => {

				rawData += chunk;

			} );

			apiRes.on( 'end', () => {

				try {

					const parsedData = JSON.parse( rawData );

					db.prepare( `INSERT OR IGNORE INTO commits ( sha, ref, author, message, authored_at ) VALUES ( ?, ?, ?, ?, ? )` ).run(
						parsedData.sha, '-', parsedData.author.name, parsedData.message, parsedData.author.date
					);

					db.prepare( 'UPDATE commits SET state = "uploaded" WHERE sha = ?' ).run( parsedData.sha );

					res.status( 200 ).send( '' );

				} catch ( e ) {

					console.error( e.message );

					res.status( 500 ).send( e.message );

				}

			} );

		} ).on( 'error', ( e ) => {

			console.error( `Got error: ${e.message}` );

			res.status( 500 ).send( e.message );

		} );

	} else {

		console.error( 'Not all files found' );

		res.status( 500 ).send( 'Not all files found' );

		return false;

	}

} );


// default route
app.get( '*', ( req, res ) => {

	res.sendStatus( 404 );

} );

const port = config.api.live.port;
const host = config.api.live.host;

console.log( `Starting server on ${host}:${port}...` );

app.listen( port, host, () => console.log( 'Server started' ) );


const terminator = function ( sig ) {

	if ( typeof sig === 'string' ) {

		console.log( `Received ${sig}` );

		console.log( `${Date( Date.now() )}: Server stopped` );

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
