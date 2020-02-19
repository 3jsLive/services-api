const jsonStableStringify = require( 'json-stable-stringify' );
const path = require( 'path' );
const shell = require( 'shelljs' );

const Run = require( '../helpers/Run' );
const Revision = require( '../helpers/Revision' );
const { getParent, isBase } = require( '../helpers/History' ); // Not actually a class

// config.api.dependencies.*
const config = require( 'rc' )( '3cidev' );

// logging
const { Signale } = require( 'signale' );
const logger = new Signale( { scope: 'API Dependencies', config: { displayTimestamp: true, displayDate: true } } );

// DB
const Database = require( 'better-sqlite3' );
const db = new Database( path.join( config.root, config.api.database ), { fileMustExist: true/* , verbose: console.log */ } );


const routes = {
	'/sha/:sha': getDependencies
};

module.exports = {
	routes: Object.entries( routes ).reduce( ( all, [ route, handler ] ) => {

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

	getDependencies
};

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
function getDependencies( req, res ) {

	const gitDir = path.join( config.root, config.threejsRepository );

	// Prep:
	// If we can't find a suitable answer, we'll just send every examples the requested revision has to offer
	const allExamplesOfRevision = [];
	const fullResult = shell.exec(
		`git ls-tree --name-only --full-name --full-tree ${req.params.sha} examples/*_*.html`,
		{ cwd: gitDir, encoding: 'utf8', silent: true }
	);
	if ( fullResult.code === 0 ) {

		allExamplesOfRevision.push( ...fullResult.stdout.trim().split( /\n/g ) );
		allExamplesOfRevision.sort();

	} else {

		logger.error( `Failed getting the emergency-all-examples-dump for ${req.params.sha}: ${fullResult.code} ${fullResult.stdout} ${fullResult.stderr}` );

		res.status( 500 ).send( 'Error looking up requested revision' );

		return false;

	}


	// Step 0:
	// Early exit if it's a base commit
	if ( isBase( req.params.sha, gitDir ) ) {

		logger.debug( `REQUEST ${req.params.sha} is base, sending everything (${allExamplesOfRevision.length})` );

		res.status( 200 ).contentType( 'application/json' ).send( jsonStableStringify( allExamplesOfRevision ) );

		return true;

	}


	// Step 1:
	// What's the parent's SHA?
	let parentSha;
	try {

		// passing a raw user-controlled value to an *.exec still feels scary, but it should be purely A-F0-9
		parentSha = getParent( req.params.sha, gitDir );

	} catch ( err ) {

		logger.fatal( `Something went wrong looking up the parent SHA for '${req.params.sha}', sending everything.`, err );

		res.status( 200 ).contentType( 'application/json' ).send( jsonStableStringify( allExamplesOfRevision ) );

		return false;

	}

	if ( ! parentSha || parentSha.length !== 40 ) {

		logger.error( `No parent revision found for SHA '${req.params.sha}', sending everything.` );

		res.status( 200 ).contentType( 'application/json' ).send( jsonStableStringify( allExamplesOfRevision ) );

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

		// again, fail open
		res.status( 200 ).contentType( 'application/json' ).send( jsonStableStringify( allExamplesOfRevision ) );

		return false;

	}


	if ( queryResult.length === 0 ) {

		logger.error( `Something went wrong while requesting deptree for ${req.params.sha}` );

		res.status( 200 ).contentType( 'application/json' ).send( jsonStableStringify( allExamplesOfRevision ) );

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

	Object.keys( depTree ).forEach( key => depTree[ key ].sort() );

	// logger.debug( depTree );


	// Step 3:
	// Ask git what changed between the parent and the current commit
	// TODO: ask first, *then* create depTree for better performance?
	const retval = shell.exec( `git diff --name-only ${req.params.sha} ${parentSha}`, { encoding: 'utf8', silent: true, cwd: gitDir } );

	if ( retval.code === 0 ) {

		const files = retval.stdout.split( /\n/g );

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

		todo.sort();

		res.status( 200 ).contentType( 'application/json' ).send( jsonStableStringify( todo ) );

		return true;

	} else {

		logger.fatal( `git diff failed:`, retval );

		res.status( 200 ).contentType( 'application/json' ).send( jsonStableStringify( allExamplesOfRevision ) );

		return false;

	}

}

module.exports = { getDependencies };

