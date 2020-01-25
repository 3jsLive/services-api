const Database = require( '../Database' );

// TODO: update to static database functions

class Dependency {

	static #db = Database.getConnection();

	constructor() {

		this.dependencyId = - 1;
		this.revisionId = - 1;
		this.srcFileId = - 1;
		this.depFileId = - 1;
		this.value = null;

		this.srcFilename = null;
		this.depFilename = null;

	}

	loadFilenames() {

		const sqlLoadFilename = Dependency.#db.prepare( 'SELECT name FROM files WHERE fileId = ?' );

		if ( this.srcFileId > 0 && this.depFileId > 0 ) {

			let result = sqlLoadFilename.get( this.srcFileId );
			if ( 'name' in result ) {

				this.srcFilename = result.name;

			} else {

				throw new Error( `Cannot loadFilenames, unknown srcFileId: ${this.srcFileId}` );

			}

			result = sqlLoadFilename.get( this.depFileId );
			if ( 'name' in result ) {

				this.depFilename = result.name;

			} else {

				throw new Error( `Cannot loadFilenames, unknown depFileId: ${this.depFileId}` );

			}

		} else {

			throw new Error( `Cannot loadFilenames, invalid fileIds: ${this.srcFileId}, ${this.depFileId}` );

		}

	}

	create( revisionId, srcFileId, depFileId ) {

		if ( Number.isInteger( revisionId ) === false || revisionId <= 0 )
			throw new Error( `Cannot createNew, invalid argument: ${revisionId}` );

		if ( Number.isInteger( srcFileId ) === false || srcFileId <= 0 )
			throw new Error( `Cannot createNew, invalid argument: ${srcFileId}` );

		if ( Number.isInteger( depFileId ) === false || depFileId <= 0 )
			throw new Error( `Cannot createNew, invalid argument: ${depFileId}` );

		const sqlCreateNew = Dependency.#db.prepare( 'INSERT OR IGNORE INTO dependencies ( revisionId, srcFileId, depFileId, value ) VALUES ( ?, ?, ?, 1 )' );

		const result = sqlCreateNew.run( revisionId, srcFileId, depFileId );
		if ( result.changes !== 1 )
			throw new Error( `Cannot createNew, zero rows inserted?` );

		this.dependencyId = result.lastInsertRowid;

		return this;

	}

	loadByDependencyId( depId ) {

		const sqlLoadByDepId = Dependency.#db.prepare( 'SELECT * FROM dependencies WHERE dependencyId = ?' );

		if ( Number.isInteger( depId ) && depId > 0 ) {

			const result = sqlLoadByDepId.get( depId );

			if ( 'dependencyId' in result ) {

				this.dependencyId = result.dependencyId;
				this.revisionId = result.revisionId;
				this.srcFileId = result.srcFileId;
				this.depFileId = result.depFileId;
				this.value = result.value;

				return;

			}

			throw new Error( `Cannot loadByDependencyId, no results for: ${depId}` );

		}

		throw new Error( `Cannot loadByDependencyId, invalid argument: ${depId}` );

	}

	cloneAndNull( newRevisionId ) {

		if ( Number.isInteger( newRevisionId ) && newRevisionId > 0 ) {

			const sqlCloneAndNull = Dependency.#db.prepare( 'INSERT OR IGNORE INTO dependencies ( revisionId, srcFileId, depFileId, value ) VALUES ( ?, ?, ?, NULL )' );

			const result = sqlCloneAndNull.run( newRevisionId, this.srcFileId, this.depFileId );

			if ( result.changes !== 1 )
				throw new Error( `Cannot cloneAndNull dependency #${this.dependencyId}, zero rows affected: ${newRevisionId}` );
			else
				return;

		}

		throw new Error( `Cannot cloneAndNull dependency #${this.dependencyId}, invalid argument: ${newRevisionId}` );

	}

}


module.exports = Dependency;
