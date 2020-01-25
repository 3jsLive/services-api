const path = require( 'path' );
const git = require( 'nodegit' );
const config = require( 'rc' )( '3cidev' );
const shell = require( 'shelljs' );

// logging
const { Signale } = require( 'signale' );
const logger = new Signale( { scope: 'API CI', config: { displayTimestamp: true, displayDate: true } } );

const Database = require( 'better-sqlite3' );
const db = new Database( path.join( config.root, config.api.database ), { fileMustExist: true } );


// linters summary page TODO: WIP
// app.get( '/runInfo/:runId/linters', ( req, res ) => {
// 	if ( /^[0-9]+$/i.test( req.params.runId ) !== true ) {
// 		console.error( 'Invalid runId:', req.params.runId );
// 		res.status( 500 ).send( 'Invalid runId' );
// 		return false;
// 	}
// 	const content = fs.readFileSync( `${config.jsonPath}${req.params.sha}-doobDoc.json`, 'utf8' ); // FIXME: debugging
// 	res.status( 200 ).contentType( 'application/json' ).send( content );
// } );

const routes = {

	//  revision summary and overview page
	'/runInfo/:runId': summary,

	'/runInfo/:runId/backstory': backstory,

	'/runInfo/:runId/overview': overview,

	'/runInfo/:runId/sparkline': sparkLines,

	'/runInfo/:runId/tests': tests,

	'/runInfo/:runId/quickInfo': quickInfo

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

	const result = db.prepare( `SELECT
		runs.timestamp, runs.duration, runs.delayAfterCommit,
		runs.reason, runs.baselineRunId, runs.parentRunId,
		runs.dependenciesChanged, runs.majorErrors,
		machines.info,
		revisions.sha,
		overviews.overviewJson
		FROM runs
	LEFT JOIN machines USING(machineId)
	LEFT JOIN revisions USING(revisionId)
	LEFT JOIN overviews USING(overviewId)
	WHERE runs.runId = ?` ).get( req.params.runId );

	res.status( 200 ).contentType( 'application/json' ).send( result );

}


function loadOverview( runId ) {

	const results = db.prepare( `SELECT tests.name, SUM(value) value
	FROM runs2results
	LEFT JOIN results USING(resultId)
	LEFT JOIN tests USING(testId)
	WHERE runs2results.runId = ?
	GROUP BY testId` ).all( runId );

	const baseResults = db.prepare( `SELECT tests.name, SUM(value) value
	FROM runs2results
	LEFT JOIN results USING(resultId)
	LEFT JOIN tests USING(testId)
	WHERE runs2results.runId = (SELECT baselineRunId FROM runs WHERE runId = ?)
	GROUP BY testId` ).all( runId );

	const parentResults = db.prepare( `SELECT tests.name, SUM(value) value
	FROM runs2results
	LEFT JOIN results USING(resultId)
	LEFT JOIN tests USING(testId)
	WHERE runs2results.runId = (SELECT parentRunId FROM runs WHERE runId = ?)
	GROUP BY testId` ).all( runId );

	const errorResults = db.prepare( `SELECT tests.name, errors.value
	FROM errors
	LEFT JOIN runs USING(runId)
	LEFT JOIN tests USING(testId)
	WHERE runId = ?` ).all( runId );

	const test2error = errorResults.reduce( ( all, { name, value } ) => {

		all[ name ] = value;
		return all;

	}, {} );

	return results.reduce( ( all, { name, value } ) => {

		// always there
		all[ name ] = {
			result: value,
			errors: ( typeof test2error[ name ] !== 'undefined' ) ? test2error[ name ] : 0
		};

		// find the results for the current test (sloooow)
		const parent = parentResults.find( element => element.name === name );
		const baseline = baseResults.find( element => element.name === name );

		if ( parent && typeof parent.value !== 'undefined' ) {

			all[ name ][ 'parent' ] = parent.value;
			all[ name ][ 'parentDelta' ] = ( parent.value === 0 ) ? value : ( 1 - ( value / parent.value ) );

		}

		if ( baseline && typeof baseline.value !== 'undefined' ) {

			all[ name ][ 'baseline' ] = baseline.value;
			all[ name ][ 'baselineDelta' ] = ( baseline.vallue === 0 ) ? value : ( 1 - ( value / baseline.value ) );

		}

		return all;

	}, {} );

}


function overview( req, res ) {

	const merged = loadOverview( req.params.runId );

	res.status( 200 ).contentType( 'application/json' ).send( merged );

}


function sparkLines( req, res ) {

	const commit = db.prepare( 'SELECT sha FROM runs LEFT JOIN revisions USING(revisionId) WHERE runs.runId = ?' ).get( req.params.runId ).sha;

	let ancestry;
	try {

		ancestry = pathToBase( commit );

	} catch ( err ) {

		logger.error( `pathToBase failed for ${commit}` );
		res.status( 500 ).send( 'sparklines: history lookup failed' );
		return [];

	}

	const placeholdersCommits = new Array( ancestry.length ).fill( '?' ).join( ',' );

	const availableRuns = db.prepare( `SELECT runId, sha
		FROM runs
		LEFT JOIN revisions USING(revisionId)
		WHERE sha IN (${placeholdersCommits})` ).all( ...ancestry );

	// this should be the same length as placeholdersCommits, but sometimes it isn't
	const placeholdersRuns = new Array( availableRuns.length ).fill( '?' ).join( ',' );

	const results = db.prepare( `SELECT runs2results.runId, tests.name, SUM(value) result
		FROM runs2results
		LEFT JOIN results USING(resultId)
		LEFT JOIN tests USING(testId)
		WHERE runs2results.runId IN (${placeholdersRuns})
		GROUP BY runId, testId` ).all( ...availableRuns.map( run => run.runId ) );

	const data = results.reduce( ( all, { runId, name, result } ) => {

		// always there
		all[ name ] = { ...( all[ name ] || {} ), [ runId ]: result };

		return all;

	}, {} );

	res.status( 200 ).contentType( 'application/json' ).send( data );

}


function tests( req, res ) {

	const tests = db.prepare( `SELECT tests.testId testId, tests.name name, tests.description description, tests.text text, tests.\`group\` \`group\`, tests.flaky flaky, 'on' status FROM runs
	LEFT JOIN runs2results USING(runId)
	LEFT JOIN results USING(resultId)
	LEFT JOIN tests USING(testId)
	WHERE runId = $runId
	GROUP BY name

	UNION

	SELECT *, 'off' status FROM
	(
		SELECT testId, name, description, text, \`group\`, flaky FROM tests WHERE 1
		GROUP BY name

		EXCEPT

		SELECT tests.testId testId, tests.name name, tests.description description, tests.text text, tests.\`group\` \`group\`, tests.flaky flaky FROM runs
		LEFT JOIN runs2results USING(runId)
		LEFT JOIN results USING(resultId)
		LEFT JOIN tests USING(testId)
		WHERE runId = $runId
		GROUP BY name

		ORDER BY \`group\` ASC, name ASC
	)
	GROUP BY name
	ORDER BY \`group\` ASC, name ASC` ).all( { runId: req.params.runId } );

	res.status( 200 ).contentType( 'application/json' ).send( tests );

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
