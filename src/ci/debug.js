// const path = require( 'path' );
// const config = require( 'rc' )( '3cidev' );

// helpers
const DB = require( '../Database' );
const db = DB.db;
const Dependencies = require( '../helpers/Dependencies' );
const Run = require( '../helpers/Run' );
const Revision = require( '../helpers/Revision' );
const Overview = require( '../helpers/Overview' );
const Test = require( '../helpers/Test' );
const File = require( '../helpers/File' );
const { getBase, getParent } = require( '../helpers/History' );
const Results = require( '../helpers/Results' );


// logging
const { Signale } = require( 'signale' );
const logger = new Signale( { scope: 'API CI debug', config: { displayTimestamp: true, displayDate: true } } );


const routes = {

	'/debug/run/:runId': debugRun,

	'/debug/revision/:sha': debugRevision

};


module.exports = Object.entries( routes ).reduce( ( all, [ route, handler ] ) => {

	all[ route ] = async ( req, res ) => {

		if ( req.params.runId && /^[0-9]+$/i.test( req.params.runId ) !== true ) {

			logger.error( 'Invalid runId:', req.params.runId );

			res.status( 500 ).send( 'Invalid runId' );

			return false;

		} else if ( req.params.sha && /^[a-f0-9]{40}$/i.test( req.params.sha ) !== true ) {

			logger.error( 'Invalid SHA:', req.params.sha );

			res.status( 500 ).send( 'Invalid SHA' );

			return false;

		} else if ( ! req.params.sha && ! req.params.runId ) {

			logger.error( 'Unknown debugging mode', req.params );

			res.status( 500 ).send( 'Unknown debugging mode' );

			return false;

		}

		await handler( req, res );

		return true;

	};

	return all;

}, {} );



function debugRun( req, res ) {

	const run = Run.loadByRunId( req.params.runId );

	const descendants = db.prepare( `SELECT runId FROM runs WHERE runs.baselineRunId = ?` ).all( req.params.runId ).map( r => r.runId );
	const children = db.prepare( `SELECT runId FROM runs WHERE runs.parentRunId = ?` ).all( req.params.runId ).map( r => r.runId );

	// trigger lazy loading
	// TODO: add toJSON to Run and the other helpers
	let _ = run.overview;
	_ = run.baselineRun;
	_ = run.parentRun;

	const dependencies = {
		small: ( run.fullSizeEntry === "false" ) ? Dependencies.loadByRevisionId( run.revisionId, - 1 ) : {},
		smallSrc: ( run.fullSizeEntry === "false" ) ? Dependencies.reformatToSourceBased( Dependencies.loadByRevisionId( run.revisionId, - 1 ) ) : {},
		fullSrc: run.getDependencies()
	};

	run.DEPS = dependencies;

	const results = {
		small: Results.loadByRunId( run.runId, - 1 ),
		// full: run.getResults(),
		files: Object.keys( Results.reformatToFileBased( run.getResults() ) ).length,
		tests: Object.keys( Results.reformatToTestBased( run.getResults() ) ).length
	};

	run.RESULTS = results;

	run.DESCENDANTS = descendants;
	run.CHILDREN = children;

	res.status( 200 ).contentType( 'application/json' ).send( JSON.stringify( run ) );

}


function debugRevision( req, res ) {

	// const result = db.prepare( `SELECT
	// 	srcFiles.name AS srcFiles,
	// 	JSON_GROUP_ARRAY( depFiles.name ) AS depFiles
	// FROM revisions
	// LEFT JOIN dependencies ON dependencies.revisionId = revisions.revisionId
	// LEFT JOIN files AS srcFiles ON srcFiles.fileId = dependencies.srcFileId
	// LEFT JOIN files AS depFiles ON depFiles.fileId = dependencies.depFileId
	// WHERE revisions.sha = ? AND dependencies.value IS NOT NULL
	// GROUP BY srcFiles.name` ).all( req.params.sha );

	const revision = Revision.loadBySHA( req.params.sha );

	const dependencies = Dependencies.loadByRevisionId( revision.revisionId/*, - 1 */ );

	res.status( 200 ).contentType( 'application/json' ).send( { revision, dependencies: Dependencies.reformatToSourceBased( dependencies ) } );

}
