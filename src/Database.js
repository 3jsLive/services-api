const path = require( 'path' );
const sqlite = require( 'better-sqlite3' );
const config = require( 'rc' )( '3cidev' );

// this is horrible, but also kinda adorable
module.exports = ( connection ) => {

	module.exports = ( connection ) ? connection : new sqlite( path.join( config.root, config.api.database ), { fileMustExist: true } );

};
