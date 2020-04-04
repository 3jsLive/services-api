const Database = require( '../Database' );

class Revision {

	constructor( ) {

		this.revisionId = - 1;
		this.sha = null;

	}

	static loadByRevisionId( revisionId ) {

		const query = Revision.db.prepare( 'SELECT * FROM revisions WHERE revisionId = ? LIMIT 1' );
		const result = query.get( revisionId );

		if ( ! result || 'revisionId' in result === false || 'sha' in result === false )
			throw new Error( `Loading revision #${revisionId} failed, no rows returned` );

		const retval = new Revision();
		retval.revisionId = result.revisionId;
		retval.sha = result.sha;

		return retval;

	}

	static loadBySHA( sha ) {

		const query = Revision.db.prepare( 'SELECT * FROM revisions WHERE sha = ? LIMIT 1' );
		const result = query.get( sha );

		if ( ! result || 'revisionId' in result === false || 'sha' in result === false )
			throw new Error( `Loading revision with SHA '${sha}' failed, no rows returned` );

		const retval = new Revision();
		retval.revisionId = result.revisionId;
		retval.sha = result.sha;

		return retval;

	}

	save() {

		if ( this.revisionId > 0 ) {

			this._update();

		} else {

			this._insert();

		}

	}

	_insert() {

		const query = Revision.db.prepare( `INSERT OR IGNORE INTO revisions (sha) VALUES ( $sha )` );

		const result = query.run( { ...this } );

		if ( result.changes !== 1 )
			Object.assign( this, Revision.loadBySHA( this.sha ) ); // hax
		else
			this.revisionId = result.lastInsertRowid;

	}

	_update() {

		const query = Revision.db.prepare( `UPDATE revisions SET sha = $sha WHERE revisionId = $revisionId` );

		const result = query.run( { ...this } );

		if ( result.changes !== 1 )
			throw new Error( `Couldn't save revision` );

	}

}

// working around eslint/ts syntax issues
Revision.db = Database.db;

module.exports = Revision;
