const { createHandler } = require( './utils' );


const category = 'profiling';

module.exports = {

	// stats tracking TODO: WIP debug
	'/profilingStats/showFile/:sha': createHandler( category, 'statsResults-examples_webgl_loader_gltf' )

};
