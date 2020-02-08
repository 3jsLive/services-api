const path = require( 'path' );
const sqlite = require( 'better-sqlite3' );
const config = require( 'rc' )( '3cidev' );

class Database {

	static getConnection() {

		if ( Database._db === null )
			Database._db = new sqlite( path.join( config.root, config.api.database ), { fileMustExist: true } );

		return Database._db;

	}

}

Database._db = null;

module.exports = Database;
