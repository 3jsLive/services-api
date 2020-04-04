const path = require( 'path' );
const sqlite = require( 'better-sqlite3' );
const config = require( 'rc' )( '3cidev' );

const db = function () {

	return { db: new sqlite( path.join( config.root, config.api.database ), { fileMustExist: true } ) };

};

module.exports = db();
