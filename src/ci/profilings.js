
module.exports = {

	'/ProfConsole/showFile/:sha': returnMerged

};


// WIP below
const fs = require( 'fs' );
const path = require( 'path' );
const stringify = require( 'json-stable-stringify' );

const config = require( 'rc' )( '3cidev' );

const Run = require( '../helpers/Run' );
const Revision = require( '../helpers/Revision' );

// logging
const { Signale } = require( 'signale' );
const logger = new Signale( { scope: 'API CI', config: { displayTimestamp: true, displayDate: true } } );


// so, ProfConsole-* contains every consoleLog result from the current run
// but: if the current run only included 2 examples, we're obviously missing
//      the results from the 300-something other examples that are still valid
// hence: we merge current run ProfConsole-* and baseline ProfConsole-* together
// TODO: this could be rendered obsolete by finally saving test results in the database
function returnMerged( req, res ) {

	if ( ! req.params.sha || /^[a-f0-9]{40}$/i.test( req.params.sha ) !== true ) {

		logger.error( 'Invalid SHA:', req.params.sha );

		res.status( 500 ).send( 'Invalid SHA' );

		return false;

	}

	const sha = req.params.sha;

	let run;
	try {

		const revision = Revision.loadBySHA( sha );
		run = Run.loadByRevisionId( revision.revisionId );

	} catch ( err ) {

		logger.error( `returnMerged: Couldn't load run with sha: ${sha} -> ${err}` );

		res.status( 500 ).contentType( 'application/json' ).send( `Couldn't load run` );

		return false;

	}

	// hardcoded hack
	const pathJson = path.join( config.api.ci.jsonPath, 'profiles' );

	const pathCurrent = path.join( pathJson, `ProfConsole-${sha}.json` );
	const dataCurrent = JSON.parse( fs.readFileSync( pathCurrent, 'utf8' ) );

	let pathBase;
	let dataBase = { errors: [], hits: 0, results: {} };
	if ( run.baselineRun !== null ) {

		pathBase = path.join( pathJson, `ProfConsole-${run.baselineRun.revision.sha}.json` );
		dataBase = JSON.parse( fs.readFileSync( pathBase, 'utf8' ) );

	}

	const merged = {
		errors: [ ...dataBase.errors, ...dataCurrent.errors ],
		hits: 0,
		results: {
			...dataBase.results,
			...dataCurrent.results
		}
	};

	merged.hits = Object.keys( merged.results ).reduce( ( total, filename ) => {

		total += merged.results[ filename ].results.length;

		return total;

	}, 0 );

	res.status( 200 ).contentType( 'application/json' ).send( stringify( merged ) );

}
