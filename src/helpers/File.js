const Database = require( '../Database' );

class File {

	constructor() {

		this.fileId = - 1;
		this.name = '';

	}

	/**
	 * @returns {File[]}
	 */
	static loadAll() {

		const query = File.db.prepare( 'SELECT fileId FROM files WHERE 1' );
		const results = query.all();

		if ( ! results || results.length === 0 )
			return [];

		return results.map( r => File.loadByFileId( r.fileId ) );

	}

	static loadByFileId( fileId ) {

		const query = File.db.prepare( 'SELECT * FROM files WHERE fileId = ? LIMIT 1' );
		const result = query.get( fileId );

		if ( ! result || 'fileId' in result === false )
			throw new Error( `Loading file ${fileId} failed, no rows returned` );

		const file = new this();

		file.fileId = result.fileId;
		file.name = result.name;

		return file;

	}

	static loadByName( name ) {

		const query = File.db.prepare( 'SELECT * FROM files WHERE name = ? LIMIT 1' );
		const result = query.get( name );

		if ( ! result || 'fileId' in result === false )
			throw new Error( `Loading file '${name}' failed, no rows returned` );

		const file = new this();

		file.fileId = result.fileId;
		file.name = result.name;

		return file;

	}

	save() {

		// no type checking the object's values, let it crash and burn
		const sqlInsertOrIgnore = File.db.prepare( `INSERT OR IGNORE INTO files ( name ) VALUES ( $name )` );

		/* const result = */ sqlInsertOrIgnore.run( { name: this.name } );
		// if ( result.changes !== 1 )
		 	// throw new Error( `Couldn't save file '${this.name}', zero rows inserted?` );

		this.fileId = File.loadByName( this.name ).fileId;

		return this;

	}

}

// working around eslint/ts syntax issues
File.db = Database;


module.exports = File;
