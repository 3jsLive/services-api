const jsonStableStringify = require( 'json-stable-stringify' );
const path = require( 'path' );
const shell = require( 'shelljs' );
const glob = require( 'glob' );


const Run = require( '../incoming/helpers/Run' );
const Revision = require( '../incoming/helpers/Revision' );
const File = require( '../incoming/helpers/File' );

const express = require( 'express' );
const cors = require( 'cors' );

// setup HTTP server for incoming API requests
const app = express();
app.use( cors() );

// config.api.dependencies.*
const config = require( 'rc' )( '3cidev' );

// logging
const { Signale } = require( 'signale' );
const logger = new Signale( { scope: 'API Dependencies', config: { displayTimestamp: true, displayDate: true } } );

// DB
const Database = require( 'better-sqlite3' );
const db = new Database( path.join( config.root, config.api.database ), { fileMustExist: true/* , verbose: console.log */ } );


// returns examples that need to be re-run and -analyzed
app.get( '/sha/:sha', ( req, res ) => {

	// only valid and full-length SHAs accepted
	if ( /^[a-f0-9]{40}$/i.test( req.params.sha ) !== true ) {

		logger.error( 'Invalid SHA:', req.params.sha );

		res.status( 500 ).send( 'Invalid SHA' );

		return false;

	}

	const gitDir = path.join( config.root, config.threejsRepository );

	// Step 0:
	// Early exit if it's a base commit
	const baseResult = shell.exec( `git log --max-count=1 --oneline ${req.params.sha}`, { cwd: gitDir, encoding: 'utf8', silent: true } );
	if ( baseResult.code === 0 ) {

		if ( baseResult.stdout.includes( 'Updated builds.' ) === true || /\br1[0-9]{2}\b/.test( baseResult.stdout ) === true ) {

			// everything.
			const allHtmlFiles = glob.sync( path.join( gitDir, '{docs,examples}', '**', '*.html' ) ).map( p => path.relative( gitDir, p ) );

			logger.debug( `REQUEST ${req.params.sha} is base, sending everything (${allHtmlFiles.length})` );

			res.status( 200 ).send( jsonStableStringify( allHtmlFiles ) );

			return true;

		}

	}


	// Step 1:
	// What's the parent's SHA?
	// passing a raw user-controlled value to an *.exec still feels scary, but it should be purely A-F0-9
	const result = shell.exec( `git rev-parse "${req.params.sha}^"`, { encoding: 'utf8', silent: true, cwd: gitDir } );
	if ( result.code !== 0 || ! result.stdout ) {

		logger.error( `No parent revision found for SHA '${req.params.sha}': ${result.code} ${result.stdout} ${result.stderr}` );

		res.status( 404 ).send( 'Requested revision not found' );

		return false;

	}

	const parentSha = result.stdout.trim();
	if ( ! parentSha || parentSha.length !== 40 ) {

		logger.error( `Something went wrong looking up the parent SHA: ${result.stdout} ${result.stderr}` );

		res.status( 500 ).send( 'Error looking up parent SHA' );

		return false;

	}


	// Step 2:
	// Do we have a run for this SHA? Get its dependencies tree
	let queryResult = [];
	try {

		const parentRev = Revision.loadBySHA( parentSha );
		const parentRun = Run.loadByRevisionId( parentRev.revisionId );

		const baseRevId = ( parentRun.baselineRun !== null ) ? parentRun.baselineRun.revisionId : - 1;

		if ( baseRevId === - 1 )
			logger.debug( `parentRun #${parentRun.runId} has no baseline` );

		logger.debug( `Request: SHA ${req.params.sha} has PARENT ${parentSha} -> PARENT-REVID ${parentRev.revisionId} and BASE-REVID ${baseRevId}` );

		const query = db.prepare( `SELECT srcFileId, value, filesSrc.name src, JSON_GROUP_ARRAY( filesDep.name ) deps
		FROM
		(
			SELECT * FROM dependencies WHERE (revisionId = $parent OR revisionId = $base)
			ORDER BY CASE revisionId
				WHEN $parent THEN 1
				WHEN $base THEN 0
			END
		)
		LEFT JOIN files filesSrc ON filesSrc.fileId = srcFileId
		LEFT JOIN files filesDep ON filesDep.fileId = depFileId
		GROUP BY srcFileId HAVING value` );

		queryResult = query.all( { parent: parentRev.revisionId, base: baseRevId } );

	} catch ( err ) {

		logger.fatal( 'Error deptree:', err );

		res.status( 501 ).send( `Internal Error: deptree` );

		return false;

	}


	if ( queryResult.length === 0 ) {

		logger.error( `Something went wrong while requesting deptree for ${req.params.sha}` );

		res.status( 501 ).send( 'Unknown error' );

		return false;

	}

	// logger.debug( queryResult.map( r => `${r.src} depends on ${r.deps}` ).join( '\n' ) );

	// reduce queryResult to hash
	// not very efficient, but it works
	const depTree = queryResult.reduce( ( all, cur ) => {

		JSON.parse( cur.deps ).forEach( dep => {

			all[ dep ] = all[ dep ] || [];

			if ( all[ dep ].includes( cur.src ) === false )
				all[ dep ].push( cur.src );

		} );

		return all;

	}, {} );

	// logger.debug( depTree );


	// Step 3:
	// Ask git what changed between the parent and the current commit
	// TODO: ask first, *then* create depTree for better performance?

	const retval = shell.exec( `git diff --name-only ${req.params.sha} ${parentSha}`, { encoding: 'utf8', silent: true, cwd: gitDir } );

	if ( retval.code === 0 ) {

		const files = retval.stdout.split( /\n/g );

		// this would create a nice touchedFile -> examples_that_need_a_visit hashmap,
		// but that hashmap also contains lots of duplicates for any diff of moderate-ish size
		/* const todo = files.reduce( ( all, touchedFile ) => {

			if ( touchedFile in depTree === false )
				return all;

			all[ touchedFile ] = depTree[ touchedFile ] || [];
			all[ touchedFile ].push( ...( depTree[ touchedFile ].filter( d => all[ touchedFile ].includes( d ) === false ) ) );

			return all;

		}, {} ); */

		// instead: just a list of examples. nothing more.
		const todo = files.reduce( ( all, touchedFile ) => {

			// obvs skip files we don't know
			if ( touchedFile in depTree === false ) {

				if ( touchedFile.endsWith( '.html' ) === true ) // unless it's an example, then add it
					all.push( touchedFile );

			} else {

				// push all that aren't yet in it
				all.push( ...( depTree[ touchedFile ].filter( d => all.includes( d ) === false ) ) );

			}

			return all;

		}, [] );

		// logger.debug( todo );

		res.status( 200 ).contentType( 'application/json' ).send( jsonStableStringify( todo ) );

		return true;

	} else {

		logger.fatal( `git diff failed:`, retval );

		res.status( 501 ).send( 'Error' );

		return false;

	}

} );


// FIXME: is this useful? it depends on pre-existing dependencies after all
/* app.get( '/single/:sha/:file', ( req, res ) => {

	// only valid and full-length SHAs accepted
	if ( /^[a-f0-9]{40}$/i.test( req.params.sha ) !== true ) {

		logger.error( 'Invalid SHA:', req.params.sha );

		res.status( 500 ).send( 'Invalid SHA' );

		return false;

	}

	// file is obvs not optional
	if ( ! req.params.file || req.params.file.length === 0 ) {

		logger.error( 'Invalid filename:', req.params.file );

		res.status( 500 ).send( 'Invalid filename' );

		return false;

	}


	const childRev = Revision.loadBySHA( req.params.sha );
	const run = Run.loadByRevisionId( childRev.revisionId );
	const baseRev = run.baselineRun.revision;
	const file = File.loadByName( req.params.file );

	logger.debug( { childRev, run, baseRev, file } );


	// should return a list of files we need to re-check
	const query = db.prepare( `SELECT srcFileId, value, files.name name FROM (
			SELECT srcFileId, value FROM dependencies
			WHERE (revisionId = $child OR revisionId = $base) AND depFileId = $depFileId
			ORDER BY CASE revisionId
			  WHEN $child THEN 1
			  WHEN $base THEN 0
			END
		) LEFT JOIN files ON fileId = srcFileId
		GROUP BY srcFileId HAVING value` );

	const result = query.all( { child: childRev.revisionId, base: baseRev.revisionId, depFileId: file.fileId } );

	const json = { todo: [] };

	if ( result.length > 0 )
		json.todo = result.map( r => r.name ); // we only care for the example's name

	res.status( 200 ).contentType( 'application/json' ).send( jsonStableStringify( json ) );

	return true;

} ); */

// ----------------------------------------------------------------------------------------------------------- //


// default route
app.get( '*', ( req, res ) => {

	logger.debug( '/*' );

	res.sendStatus( 404 );

} );


// boilerplate
const port = config.api.dependencies.port;
const host = config.api.dependencies.host;

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
