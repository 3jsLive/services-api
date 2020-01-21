const fs = require( 'fs' );
const path = require( 'path' );

const config = require( 'rc' )( '3cidev' );

// logging
const { Signale } = require( 'signale' );
const logger = new Signale( { scope: 'API CI', config: { displayTimestamp: true, displayDate: true } } );


function createHandler( category, fileStub, dataPath ) {

	if ( ! category )
		throw new Error( 'Missing category:', category );

	if ( ! fileStub )
		throw new Error( 'Missing file stub:', fileStub );

	if ( ! dataPath )
		dataPath = path.join( config.api.ci.jsonPath, category );

	return function ( req, res ) {

		if ( ! req.params.sha || /^[a-f0-9]{40}$/i.test( req.params.sha ) !== true ) {

			logger.error( 'Invalid SHA:', req.params.sha );

			res.status( 500 ).send( 'Invalid SHA' );

			return false;

		}

		const jsonFile = path.join( dataPath, `${fileStub}-${req.params.sha}.json` );

		try {

			const content = fs.readFileSync( jsonFile, 'utf8' );

			res.status( 200 ).contentType( 'application/json' ).send( content );

			return true;

		} catch ( err ) {

			logger.error( 'API handler failed:', jsonFile, err );

			res.status( 500 ).send( 'internal error' );

			throw err;

		}

	};

}


module.exports = {
	createHandler,
	history: require( './base-parent-path' )
};
