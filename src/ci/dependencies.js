const { createHandler } = require( './utils' );


const category = 'dependencies';

module.exports = {

	// faulty dependencies detection for docs-docs connections
	'/DocsDocsDeps/showFile/:sha': createHandler( category, 'DocsDocsDeps' )

};
