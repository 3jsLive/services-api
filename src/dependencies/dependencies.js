const jsonStableStringify = require( 'json-stable-stringify' );
const path = require( 'path' );
const shell = require( 'shelljs' );

const Run = require( '../helpers/Run' );
const Revision = require( '../helpers/Revision' );
const { getParent, isBase } = require( '../helpers/History' ); // Not actually a class
const Dependencies = require( '../helpers/Dependencies' );

// config.api.dependencies.*
const config = require( 'rc' )( '3cidev' );

// logging
const { Signale } = require( 'signale' );
const logger = new Signale( { scope: 'API Dependencies', config: { displayTimestamp: true, displayDate: true } } );

// DB
// const Database = require( 'better-sqlite3' );
// const db = new Database( path.join( config.root, config.api.database ), { fileMustExist: true/* , verbose: console.log */ } );


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
		`git ls-tree --name-only --full-name --full-tree ${req.params.sha} examples/ | grep _`,
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
	let parentRev, baseRevId;
	try {

		// load parent run for its revision id
		parentRev = Revision.loadBySHA( parentSha );
		const parentRun = Run.loadByRevisionId( parentRev.revisionId );

		// get base run revision id
		baseRevId = ( parentRun.baselineRun !== null ) ? parentRun.baselineRun.revisionId : - 1;

		if ( baseRevId === - 1 )
			logger.debug( `parentRun #${parentRun.runId} has no baseline` );

		logger.debug( `Request: SHA ${req.params.sha} has PARENT ${parentSha} -> PARENT-REVID ${parentRev.revisionId} and BASE-REVID ${baseRevId}` );

	} catch ( err ) {

		logger.fatal( 'Error parent revision:', err );

		// again, fail open
		res.status( 200 ).contentType( 'application/json' ).send( jsonStableStringify( allExamplesOfRevision ) );

		return false;

	}


	// Step 3:
	// Ask git what changed between the parent and the current commit
	// TODO: ask first, *then* create depTree for better performance?
	const retval = shell.exec( `git diff --name-status ${req.params.sha} ${parentSha}`, { encoding: 'utf8', silent: true, cwd: gitDir } );

	if ( retval.code === 0 ) {

		// parse the git output
		const actions = Dependencies.parseGitDiff( retval.stdout );


		// load merged dependencies
		const deps = Dependencies.loadByRevisionId( parentRev.revisionId, baseRevId );
		const depTree = Dependencies.reformatToDependencyBased( deps );


		// get it all together
		const todo = Dependencies.compareWithGitDiff( depTree, actions );

		res.status( 200 ).contentType( 'application/json' ).send( jsonStableStringify( todo ) );

		return true;

	} else {

		logger.fatal( `git diff failed:`, retval );

		res.status( 200 ).contentType( 'application/json' ).send( jsonStableStringify( allExamplesOfRevision ) );

		return false;

	}

}
