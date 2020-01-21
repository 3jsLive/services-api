const { createHandler } = require( './utils' );


const category = 'typesearch';

module.exports = {

	// aggregated profiles for typesearch
	'/typesearchSearch/showFile/:sha': createHandler( category, 'typeProfile-results' )

};
