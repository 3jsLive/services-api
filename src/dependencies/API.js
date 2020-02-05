const jsonStableStringify = require( 'json-stable-stringify' );
const path = require( 'path' );
const shell = require( 'shelljs' );
const glob = require( 'glob' );

const Run = require( '../incoming/helpers/Run' );
const Revision = require( '../incoming/helpers/Revision' );

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

// dead-simple caching
const gitBases = {};
const gitDiffs = {};
const gitParents = {};


// returns examples that need to be re-run and -analyzed
app.get( '/sha/:sha', ( req, res ) => {

	// only valid and full-length SHAs accepted
	if ( /^[a-f0-9]{40}$/i.test( req.params.sha ) !== true ) {

		logger.error( 'Invalid SHA:', req.params.sha );

		res.status( 500 ).send( 'Invalid SHA' );

		return false;

	}


	// commonly used
	const gitDir = path.join( config.root, config.threejsRepository );
	const shellOptions = { cwd: gitDir, encoding: 'utf8', silent: true };
	const sha = req.params.sha;


	// Step 0:
	// Early exit if it's a base commit
	if ( sha in gitBases === false ) {

		const baseResult = shell.exec( `git log --max-count=1 --oneline ${sha}`, shellOptions );

		// commit message has to be either 'Updated builds.' or 'r1xx' to be considered a baseline release
		gitBases[ sha ] = ( baseResult.code === 0 && /(Updated builds\.|\br1[0-9]{2}\b)/.test( baseResult.stdout ) === true );

	}

	if ( gitBases[ sha ] === true ) {

		// everything.
		const allHtmlFiles = glob.sync( path.join( gitDir, '{docs,examples}', '**', '*.html' ) ).map( p => path.relative( gitDir, p ) );

		logger.debug( `REQUEST ${sha} is base, sending everything (${allHtmlFiles.length})` );

		res.status( 200 ).send( jsonStableStringify( allHtmlFiles ) );

		return true;

	}


	// Step 1:
	// What's the parent's SHA?
	if ( sha in gitParents === false ) {

		// passing a raw user-controlled value to an *.exec still feels scary, but it should be purely A-F0-9
		const result = shell.exec( `git rev-parse "${sha}^"`, shellOptions );

		if ( result.code !== 0 || ! result.stdout ) {

			logger.error( `No parent revision found for SHA '${sha}': ${result.code} ${result.stdout} ${result.stderr}` );

			res.status( 404 ).send( 'Requested revision not found' );

			return false;

		}

		const parentSha = result.stdout.trim();

		if ( ! parentSha || parentSha.length !== 40 ) {

			logger.error( `Something went wrong looking up the parent SHA: ${result.stdout} ${result.stderr}` );

			res.status( 500 ).send( 'Error looking up parent SHA' );

			return false;

		}

		gitParents[ sha ] = parentSha;

	}

	const parentSha = gitParents[ sha ];


	// Step 2:
	// Do we have a run for this SHA? Get its dependencies tree
	let depTree;
	try {

		const parentRev = Revision.loadBySHA( parentSha );
		const parentRun = Run.loadByRevisionId( parentRev.revisionId );

		logger.debug( `Request: SHA ${sha} has PARENT ${parentSha} -> PARENT-RUNID ${parentRun.runId} and BASE-RUNID ${parentRun.baselineRunId}` );

		depTree = parentRun.getDependencies( false );

	} catch ( err ) {

		logger.fatal( 'Error deptree:', err );

		res.status( 501 ).send( `Internal Error: deptree` );

		return false;

	}


	// Step 3:
	// Ask git what changed between the parent and the current commit
	const diffCommand = `git diff --name-only ${sha} ${parentSha}`;

	// simple caching. could cache the split/reduce below as well, but that isn't anywhere near as slow as the git command
	if ( diffCommand in gitDiffs === false )
		gitDiffs[ diffCommand ] = shell.exec( diffCommand, shellOptions );


	if ( gitDiffs[ diffCommand ].code === 0 ) {

		const files = gitDiffs[ diffCommand ].stdout.split( /\n/g );

		// just a list of examples. nothing more.
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

		logger.fatal( `git diff failed:`, gitDiffs[ diffCommand ] );

		res.status( 501 ).send( 'Error' );

		return false;

	}

} );


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
