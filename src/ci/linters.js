const path = require( 'path' );
const config = require( 'rc' )( '3cidev' );
const { createHandler, history } = require( './utils' );

// TODO: why is this mixed? sqlite & jsons?

// logging
const { Signale } = require( 'signale' );
const logger = new Signale( { scope: 'API CI', config: { displayTimestamp: true, displayDate: true } } );

const Database = require( 'better-sqlite3' );
const db = new Database( path.join( config.root, config.api.database ), { fileMustExist: true } );

const category = 'linters';


function ESLintTsFilesList( req, res ) {

	if ( /^[0-9]+$/i.test( req.params.runId ) !== true ) {

		logger.error( 'Invalid runId:', req.params.runId );

		res.status( 500 ).send( 'Invalid runId' );

		return false;

	}

	const commit = db.prepare( 'SELECT sha FROM runs LEFT JOIN revisions USING(revisionId) WHERE runs.runId = ?' ).get( req.params.runId );
	if ( ! commit ) {

		logger.error( 'SHA for runId not found:', req.params.runId );

		res.status( 500 ).send( 'SHA not found' );

		return false;

	}

	const ancestry = history.ancestry( commit.sha );
	const ancestryCommits = [ ancestry.base, ...ancestry.path.reverse() ];

	const placeholders = new Array( ancestryCommits.length ).fill( '?' ).join( ',' );

	const availableRuns = db.prepare( `SELECT runId, sha
	FROM runs
	LEFT JOIN revisions USING(revisionId)
	WHERE sha IN (${placeholders})` ).all( ...ancestryCommits );

	const results = db.prepare( `SELECT '[' || GROUP_CONCAT( runs2results.runId, ',' ) || ']' runs, tests.name test, files.name file, '[' || GROUP_CONCAT( results.value, ',' ) || ']' results
FROM runs2results
LEFT JOIN results USING(resultId)
LEFT JOIN files USING(fileId)
LEFT JOIN tests USING(testId)
WHERE
	runs2results.runId IN (${placeholders})
	AND
	tests.name = 'TSCompiler'
GROUP BY files.name ORDER BY files.name` ).all( ...availableRuns.map( run => run.runId ) );

	const data = results.reduce( ( all, result ) => {

		all[ result.file ] = { runs: JSON.parse( result.runs ), results: JSON.parse( result.results ) };
		return all;

	}, {} );

	res.status( 200 ).contentType( 'application/json' ).send( data );

	return true;

}


module.exports = {

	// linter for doobDoc formatted files
	'/DoobsDoc/showFile/:sha': createHandler( category, 'DoobsDoc' ),

	// linter for HTML files
	'/HTMLLint/showFile/:sha': createHandler( category, 'HTMLLint' ),

	// linter for JavaScript within <code> tags in HTML files
	'/ESLintCodeTags/showFile/:sha': createHandler( category, 'ESLintCodeTags' ),

	// linter for JavaScript within <script> tags in HTML files
	'/ESLintScriptTags/showFile/:sha': createHandler( category, 'ESLintScriptTags' ),

	// linter for JavaScript files
	'/ESLintJsFiles/showFile/:sha': createHandler( category, 'ESLintJsFiles' ),

	// linter for CSS files and styles embedded in HTML files
	'/StyleLint/showFile/:sha': createHandler( category, 'StyleLint' ),

	// linter for TypeScript files
	'/ESLintTsFiles/list/:runId': ESLintTsFilesList,
	'/ESLintTsFiles/showFile/:sha': createHandler( category, 'ESLintTsFiles' ),

};
