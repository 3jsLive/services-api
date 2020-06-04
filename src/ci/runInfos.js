const path = require( 'path' );
const git = require( 'nodegit' );
const config = require( 'rc' )( '3cidev' );
const shell = require( 'shelljs' );

// logging
const { Signale } = require( 'signale' );
const logger = new Signale( { scope: 'API CI', config: { displayTimestamp: true, displayDate: true } } );

// Database
const DB = require( '../Database' );
const db = DB.db;

// helpers
const Dependencies = require( '../helpers/Dependencies' );
const Run = require( '../helpers/Run' );
const Results = require( '../helpers/Results' );
const Overview = require( '../helpers/Overview' );
const Test = require( '../helpers/Test' );


const routes = {

	//  revision summary and overview page
	'/runInfo/:runId': summary,

	'/runInfo/:runId/backstory': backstory,

	'/runInfo/:runId/overview': overview,

	'/runInfo/:runId/sparkline': sparkLines,

	'/runInfo/:runId/tests': tests,

	'/runInfo/:runId/quickInfo': quickInfo,

	'/runInfo/:runId/debugRun': debugRun

};


module.exports = Object.entries( routes ).reduce( ( all, [ route, handler ] ) => {

	all[ route ] = async ( req, res ) => {

		if ( /^[0-9]+$/i.test( req.params.runId ) !== true ) {

			logger.error( 'Invalid runId:', req.params.runId );

			res.status( 500 ).send( 'Invalid runId' );

			return false;

		}

		await handler( req, res );

		return true;

	};

	return all;

}, {} );



function summary( req, res ) {

	try {

		const run = Run.loadByRunId( req.params.runId );

		const result = {
			timestamp: run.timestamp,
			duration: run.duration,
			delayAfterCommit: run.delayAfterCommit,
			reason: run.reason,
			baselineRunId: run.baselineRunId,
			parentRunId: run.parentRunId,
			fullSizeEntry: run.fullSizeEntry,
			majorErrors: run.majorErrors,
			info: ( run.machineId === 1 ) ? 'Azure' : 'other', // FIXME:
			sha: run.revision.sha,
			overviewJson: run.overview.overviewJson
		};

		res.status( 200 ).contentType( 'application/json' ).send( result );

		return true;

	} catch ( err ) {

		logger.error( `summary: Couldn't Run.loadByRunId for #${req.params.runId}: ${err}` );

		res.status( 500 ).send( 'Loading run data failed' );

		return false;

	}

}


function overview( req, res ) {

	// TODO: handle errors in testing (i.e.)

	let run;
	let merged;

	try {

		run = Run.loadByRunId( req.params.runId );

		merged = run.overview.overviewJson;

	} catch ( err ) {

		logger.error( `overview: Couldn't load requested run: ${err}` );

		res.status( 500 ).send( 'overview: invalid runId' );
		return false;

	}

	const baselineOverview = ( run.baselineRun && run.baselineRun.overview ) ? run.baselineRun.overview : new Overview();
	const parentOverview = ( run.parentRun && run.parentRun.overview ) ? run.parentRun.overview : new Overview();

	for ( const task of Object.keys( baselineOverview.overviewJson ) ) {

		if ( task in merged === false ) {

			merged[ task ] = {
				result: baselineOverview.overviewJson[ task ].result
			};

		}

		merged[ task ].baseline = baselineOverview.overviewJson[ task ].result;
		merged[ task ].baselineDelta = ( merged[ task ].baseline === 0 ) ? merged[ task ].result : ( 1 - ( merged[ task ].result / merged[ task ].baseline ) );

	}

	for ( const task of Object.keys( parentOverview.overviewJson ) ) {

		if ( task in merged === false ) {

			merged[ task ] = {
				result: parentOverview.overviewJson[ task ].result
			};

		}

		merged[ task ].parent = parentOverview.overviewJson[ task ].result;
		merged[ task ].parentDelta = ( merged[ task ].parent === 0 ) ? merged[ task ].result : ( 1 - ( merged[ task ].result / merged[ task ].parent ) );

	}

	res.status( 200 ).contentType( 'application/json' ).send( merged );

}


function sparkLines( req, res ) {

	const runs = [];

	try {

		let currentRun = Run.loadByRunId( req.params.runId );
		runs.push( currentRun );

		while ( runs.length < 20 ) {

			if ( currentRun.parentRun !== null ) {

				runs.push( currentRun.parentRun );
				currentRun = currentRun.parentRun;

			} else {

				logger.debug( `sparkLines: done looking up ancestry for #${req.params.runId}: ${runs.map( r => r.runId ).join( ', ' )}` );

				break;

			}

		}

	} catch ( err ) {

		logger.error( `sparkLines: Failed looking up run-history for #${req.params.runId}, current: ${runs.length} -> ${err}` );

		res.status( 500 ).send( 'Failed looking up run history' );

		return false;

	}


	const data = {};
	runs.forEach( run => {

		try {

			const results = run.getResults();
			const testResults = Results.reformatToTestBased( results );

			Object.keys( testResults ).forEach( testId => {

				const test = Test.loadByTestId( testId );

				data[ test.name ] = data[ test.name ] || {};
				data[ test.name ][ run.runId ] = testResults[ testId ].reduce( ( all, cur ) => {

					all += cur.value;
					return all;

				}, 0 );

			} );

		} catch ( err ) {

			logger.error( `sparkLines: Failed to process results data for run #${run.runId}: ${err}` );

		}

	} );

	res.status( 200 ).contentType( 'application/json' ).send( data );

	return true;

}


function tests( req, res ) {

	let usedTestIds;
	try {

		const results = Results.loadByRunId( req.params.runId );

		const resultsTestBased = Results.reformatToTestBased( results );

		usedTestIds = Object.keys( resultsTestBased ).map( id => Number.parseInt( id ) );

	} catch ( err ) {

		logger.error( `runInfo.tests: Failed getting results for #${req.params.runId}: ${err}` );

		res.status( 500 ).send( 'runInfo.tests: Results failed' );

		return false;

	}

	let allTestsWithStatus;
	try {

		const allTests = Test.loadAll();

		allTestsWithStatus = allTests.map( test => {

			test.status = ( usedTestIds.includes( test.testId ) === true ) ? 'on' : 'off';

			return test;

		} );

	} catch ( err ) {

		logger.error( `runInfo.tests: Failed getting current Tests for #${req.params.runId}: ${err}` );

		res.status( 500 ).send( 'runInfo.tests: Tests failed' );

		return false;

	}


	res.status( 200 ).contentType( 'application/json' ).send( allTestsWithStatus );

	return true;

}


async function quickInfo( req, res ) {

	const sha = db.prepare( 'SELECT sha FROM runs LEFT JOIN revisions USING(revisionId) WHERE runs.runId = ?' ).get( req.params.runId ).sha;
	const repository = await git.Repository.open( path.join( config.root, config.threejsRepository ) );
	const commit = await repository.getCommit( sha );

	const result = {
		author: { name: commit.author().name(), date: new Date( commit.author().when().time() * 1000 ).toUTCString() },
		message: commit.message()
	};

	res.status( 200 ).contentType( 'application/json' ).send( result );

}


function backstory( req, res ) {

	const commit = db.prepare( 'SELECT sha FROM runs LEFT JOIN revisions USING(revisionId) WHERE runs.runId = ?' ).get( req.params.runId ).sha;

	let ancestry;

	try {

		ancestry = pathToBase( commit );

	} catch ( err ) {

		logger.error( `pathToBase failed for ${commit}` );

		res.status( 500 ).send( 'backstory: history lookup failed' );

		return [];

	}

	const placeholders = new Array( ancestry.length ).fill( '?' ).join( ',' );

	const availableRuns = db.prepare( `SELECT runId, sha
	FROM runs
	LEFT JOIN revisions USING(revisionId)
	WHERE sha IN (${placeholders})` ).all( ...ancestry );

	const includingMissingRuns = ancestry.map( sha => {

		const element = availableRuns.find( run => run.sha === sha ) || { runId: - 1 };

		return { runId: element.runId, sha };

	} );

	res.status( 200 ).contentType( 'application/json' ).send( includingMissingRuns );

}


function pathToBase( commit ) {

	let baseSha;
	try {

		baseSha = shell.exec(
			`git rev-parse "${commit}^^{/(Updated builds.|r1[0-9][0-9])}"`,
			{ cwd: path.join( config.root, config.threejsRepository ), encoding: 'utf8', silent: true }
		);

	} catch ( err ) {

		logger.error( `Error while searching for base commit: ${commit}, ${baseSha.code || 'no code'}, ${baseSha.stderr || 'no stderr'}` );
		throw new Error( 'Error while searching for base commit' );

	}


	// no base found?
	if ( ! baseSha || baseSha.code !== 0 ) {

		logger.error( `No base SHA found for commit ${commit}, ${baseSha.code || 'no code'}, ${baseSha.stderr || 'no stderr'}` );
		throw new Error( 'No base SHA found' );

	}


	// we found base, clean it and use it
	baseSha = baseSha.stdout.trim();


	let history;
	try {

		history = shell.exec(
			`git rev-list --ancestry-path --reverse --first-parent --max-age=1556133894 --no-abbrev ${baseSha}...${commit}`,
			{ cwd: path.join( config.root, config.threejsRepository ), encoding: 'utf8', silent: true }
		);

	} catch ( err ) {

		logger.error( `Error while searching for commit history: ${commit}, ${history.code || 'no code'}, ${history.stderr || 'no stderr'}` );
		return [];

	}


	// no history found?
	if ( ! history || history.code !== 0 ) {

		logger.error( `No history found for commit ${commit}` );
		return [];

	}


	// and we found history as well, again clean it and return it
	history = history.stdout.trim().split( /\n/g );


	return [ baseSha, ...history ];

}

function debugRun( req, res ) {

	res.status( 200 ).contentType( 'application/json' ).send( '{}' );
	return true;


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
