const { createHandler } = require( './utils' );


const category = 'typesearch';

module.exports = {

	// aggregated profiles for typesearch
	'/typesearchSearch/showFile/:sha': createHandler( category, 'results', '/var/3ci/typesearch/' ) // FIXME: hardcoded

};
