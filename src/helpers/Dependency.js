const Database = require( '../Database' );

const File = require( './File' );
const Revision = require( './Revision' );

class Dependency {

	constructor() {

		this.dependencyId = - 1;
		// this.revisionId = - 1;
		// this.srcFileId = - 1;
		// this.depFileId = - 1;
		this.value = null;

		// this.srcFilename = null;
		// this.depFilename = null;

		this._srcFile = null;
		this._depFile = null;
		this._revision = null;

	}

	set revisionId( value ) {

		if ( value === null ) {

			this._revision = null;

		} else if ( Number.isInteger( value ) && value > 0 ) {

			if ( ! this._revision || ( this._revision && this._revision.revisionId !== value ) ) {

				this._revision = Revision.loadByRevisionId( value );

			}

		} else {

			throw new Error( 'Invalid value for revisionId:', value );

		}

	}

	get revisionId() {

		if ( this._revision ) {

			return this._revision.revisionId;

		} else {

			return null;

		}

	}

	get revision() {

		return this._revision;

	}

	set revision( value ) {

		if ( value instanceof Revision || value === null ) {

			this._revision = value;

		} else {

			throw new Error( 'Invalid value for revision:', value );

		}

	}

	set srcFileId( value ) {

		if ( value === null ) {

			this._srcFile = null;

		} else if ( Number.isInteger( value ) && value > 0 ) {

			if ( ! this._srcFile || ( this._srcFile && this._srcFile.fileId !== value ) ) {

				this._srcFile = File.loadByFileId( value );

			}

		} else {

			throw new Error( 'Invalid value for srcFileId:', value );

		}

	}

	get srcFileId() {

		if ( this._srcFile ) {

			return this._srcFile.fileId;

		} else {

			return null;

		}

	}

	get srcFile() {

		return this._srcFile;

	}

	set srcFile( value ) {

		if ( value instanceof File || value === null ) {

			this._srcFile = value;

		} else {

			throw new Error( 'Invalid value for srcFile:', value );

		}

	}

	set depFileId( value ) {

		if ( value === null ) {

			this._depFile = null;

		} else if ( Number.isInteger( value ) && value > 0 ) {

			if ( ! this._depFile || ( this._depFile && this._depFile.fileId !== value ) ) {

				this._depFile = File.loadByFileId( value );

			}

		} else {

			throw new Error( 'Invalid value for depFileId:', value );

		}

	}

	get depFileId() {

		if ( this._depFile ) {

			return this._depFile.fileId;

		} else {

			return null;

		}

	}

	get depFile() {

		return this._depFile;

	}

	set depFile( value ) {

		if ( value instanceof File || value === null ) {

			this._depFile = value;

		} else {

			throw new Error( 'Invalid value for depFile:', value );

		}

	}


	// loadFilenames() {

	// 	const sqlLoadFilename = Dependency.db.prepare( 'SELECT name FROM files WHERE fileId = ?' );

	// 	if ( this.srcFileId > 0 && this.depFileId > 0 ) {

	// 		let result = sqlLoadFilename.get( this.srcFileId );
	// 		if ( 'name' in result ) {

	// 			this.srcFilename = result.name;

	// 		} else {

	// 			throw new Error( `Cannot loadFilenames, unknown srcFileId: ${this.srcFileId}` );

	// 		}

	// 		result = sqlLoadFilename.get( this.depFileId );
	// 		if ( 'name' in result ) {

	// 			this.depFilename = result.name;

	// 		} else {

	// 			throw new Error( `Cannot loadFilenames, unknown depFileId: ${this.depFileId}` );

	// 		}

	// 	} else {

	// 		throw new Error( `Cannot loadFilenames, invalid fileIds: ${this.srcFileId}, ${this.depFileId}` );

	// 	}

	// }

	create( revisionId, srcFileId, depFileId ) {

		if ( Number.isInteger( revisionId ) === false || revisionId <= 0 )
			throw new Error( `Cannot createNew, invalid argument: ${revisionId}` );

		if ( Number.isInteger( srcFileId ) === false || srcFileId <= 0 )
			throw new Error( `Cannot createNew, invalid argument: ${srcFileId}` );

		if ( Number.isInteger( depFileId ) === false || depFileId <= 0 )
			throw new Error( `Cannot createNew, invalid argument: ${depFileId}` );

		const sqlCreateNew = Dependency.db.prepare( 'INSERT OR IGNORE INTO dependencies ( revisionId, srcFileId, depFileId, value ) VALUES ( ?, ?, ?, 1 )' );

		const result = sqlCreateNew.run( revisionId, srcFileId, depFileId );
		if ( result.changes !== 1 )
			throw new Error( `Cannot createNew, zero rows inserted?` );

		this.dependencyId = result.lastInsertRowid;

		return this;

	}

	static loadByDependencyId( depId ) {

		const sqlLoadByDepId = Dependency.db.prepare( 'SELECT * FROM dependencies WHERE dependencyId = ?' );

		if ( Number.isInteger( depId ) && depId > 0 ) {

			const result = sqlLoadByDepId.get( depId );

			if ( 'dependencyId' in result ) {

				const dep = new this();

				dep.dependencyId = result.dependencyId;
				dep.revisionId = result.revisionId;
				dep.srcFileId = result.srcFileId;
				dep.depFileId = result.depFileId;
				dep.value = result.value;

				return dep;

			}

			throw new Error( `Cannot loadByDependencyId, no results for: ${depId}` );

		}

		throw new Error( `Cannot loadByDependencyId, invalid argument: ${depId}` );

	}

	cloneAndNull( newRevisionId ) {

		if ( Number.isInteger( newRevisionId ) && newRevisionId > 0 ) {

			// on conflict?
			const sqlCloneAndNull = Dependency.db.prepare( 'INSERT OR IGNORE INTO dependencies ( revisionId, srcFileId, depFileId, value ) VALUES ( ?, ?, ?, NULL )' );

			const result = sqlCloneAndNull.run( newRevisionId, this.srcFileId, this.depFileId );

			if ( result.changes !== 1 )
				throw new Error( `Cannot cloneAndNull dependency #${this.dependencyId}, zero rows affected: ${newRevisionId}` );
			else
				return;

		}

		throw new Error( `Cannot cloneAndNull dependency #${this.dependencyId}, invalid argument: ${newRevisionId}` );

	}

}


// working around eslint/ts syntax issues
/**
 * @type {import( 'better-sqlite3' ).Database}
 */
Dependency.db = Database.getConnection();


module.exports = Dependency;
