const Database = require( '../Database' );

const File = require( './File' );
const Revision = require( './Revision' );
const Overview = require( './Overview' );

class Run {

	constructor() {

		this.runId = - 1;
		this.timestamp = - 1;
		this.duration = - 1;
		this.delayAfterCommit = - 1;
		this.reason = '';
		this.dependenciesChanged = '';
		this.machineId = 1;
		this.majorErrors = 0;
		this.type = null;

		this._revision = null;
		this._baselineRun = null;
		this._parentRun = null;
		this._overview = null;

	}

	/**
	 * @readonly
	 */
	set baselineRunId( value ) {

		throw new Error( 'baselineRunId is read-only' );

	}

	/**
	 * @returns {(Number|null)}
	 */
	get baselineRunId() {

		return ( this.baselineRun ) ? this.baselineRun.runId : null;

	}

	/**
	 * @type {(Run|null)}
	 */
	get baselineRun() {

		if ( this._baselineRun === null )
			return null;
		else if ( this._baselineRun instanceof Run === true )
			return this._baselineRun;
		else if ( Number.isInteger( this._baselineRun ) === true && this._baselineRun > 0 ) {

			this._baselineRun = Run.loadByRunId( this._baselineRun );
			return this._baselineRun;

		} else {

			throw new Error( 'invalid value for _baselineRun' );

		}

	}

	set baselineRun( value ) {

		if ( value instanceof Run || value === null ) {

			this._baselineRun = value;

		} else {

			throw new Error( 'Invalid value for baselineRun:', value );

		}

	}

	/**
	 * @readonly
	 */
	set parentRunId( value ) {

		throw new Error( 'parentRunId is read-only' );

	}

	/**
	 * @returns {(Number|null)}
	 */
	get parentRunId() {

		return ( this.parentRun ) ? this.parentRun.runId : null;

	}

	/**
	 * @type {(Run|null)}
	 */
	get parentRun() {

		if ( this._parentRun === null )
			return null;
		else if ( this._parentRun instanceof Run === true )
			return this._parentRun;
		else if ( Number.isInteger( this._parentRun ) === true && this._parentRun > 0 ) {

			this._parentRun = Run.loadByRunId( this._parentRun );
			return this._parentRun;

		} else {

			throw new Error( 'invalid value for _parentRun' );

		}

	}

	set parentRun( value ) {

		if ( value instanceof Run || value === null ) {

			this._parentRun = value;

		} else {

			throw new Error( 'Invalid value for parentRun:', value );

		}

	}

	/**
	 * @readonly
	 */
	set revisionId( value ) {

		throw new Error( 'revisionId is read-only' );

	}

	/**
	 * @returns {(Number|null)}
	 */
	get revisionId() {

		return ( this.revision ) ? this.revision.revisionId : null;

	}

	/**
	 * @type {(Revision|null)}
	 */
	get revision() {

		if ( this._revision === null )
			return null;
		else if ( this._revision instanceof Revision === true )
			return this._revision;
		else if ( Number.isInteger( this._revision ) === true && this._revision > 0 ) {

			this._revision = Revision.loadByRevisionId( this._revision );
			return this._revision;

		} else {

			throw new Error( 'invalid value for _revision' );

		}

	}

	set revision( value ) {

		if ( value instanceof Revision || value === null ) {

			this._revision = value;

		} else {

			throw new Error( 'Invalid value for revision:', value );

		}

	}

	/**
	 * @readonly
	 */
	set overviewId( value ) {

		throw new Error( 'overviewId is read-only' );

	}

	/**
	 * @returns {(Number|null)}
	 */
	get overviewId() {

		return ( this.overview ) ? this.overview.overviewId : null;

	}

	/**
	 * @type {(Overview|null)}
	 */
	get overview() {

		if ( this._overview === null )
			return null;
		else if ( this._overview instanceof Overview === true )
			return this._overview;
		else if ( Number.isInteger( this._overview ) === true && this._overview > 0 ) {

			this._overview = Overview.loadById( this._overview );
			return this._overview;

		} else {

			throw new Error( 'invalid value for _overview' );

		}

	}

	set overview( value ) {

		if ( value instanceof Overview || value === null ) {

			this._overview = value;

		} else {

			throw new Error( 'Invalid value for overview:', value );

		}

	}

	save() {

		if ( this.runId > 0 ) {

			this._update();

		} else {

			this._insert();

		}

	}

	_insert() {

		const query = Run.db.prepare( `INSERT INTO runs
			(revisionId, timestamp, duration, delayAfterCommit, reason,
				baselineRunId, parentRunId, dependenciesChanged, machineId,
				majorErrors, overviewId, type)
			VALUES
			( $revisionId, $timestamp, $duration, $delayAfterCommit, $reason,
				$baselineRunId, $parentRunId, $dependenciesChanged, $machineId,
				$majorErrors, $overviewId, $type )` );

		const result = query.run( {
			...this,
			baselineRunId: this.baselineRunId,
			parentRunId: this.parentRunId,
			revisionId: this.revisionId,
			overviewId: this.overviewId
		} );

		if ( result.changes !== 1 )
			throw new Error( `Couldn't save run` );
		else
			this.runId = result.lastInsertRowid;

	}

	_update() {

		const query = Run.db.prepare( `UPDATE runs
			SET revisionId = $revisionId, timestamp = $timestamp, duration = $duration, delayAfterCommit = $delayAfterCommit, reason = $reason,
			baselineRunId = $baselineRunId, parentRunId = $parentRunId, dependenciesChanged = $dependenciesChanged, machineId = $machineId,
			machineId = $machineId, overviewId = $overviewId, type = $type
			WHERE runId = $runId` );

		const result = query.run( { ...this, baselineRunId: this.baselineRunId, parentRunId: this.parentRunId, revisionId: this.revisionId, overviewId: this.overviewId } );

		if ( result.changes !== 1 )
			throw new Error( `Couldn't save run` );

	}

	/**
	 * @param {Number} revisionId
	 * @returns {Run}
	 */
	static loadByRevisionId( revisionId ) {

		const query = Run.db.prepare( `SELECT runId FROM runs WHERE revisionId = ? LIMIT 1` );
		const result = query.get( revisionId );

		if ( ! result || 'runId' in result === false )
			throw new Error( `Couldn't find a run with a revisionId of '${revisionId}'` );
		else
			return Run.loadByRunId( result.runId );

	}

	/**
	 * @param {Number} runId
	 * @returns {Run}
	 */
	static loadByRunId( runId ) {

		const query = Run.db.prepare( 'SELECT * FROM runs WHERE runId = ? LIMIT 1' );
		const result = query.get( runId );

		if ( ! result || 'runId' in result === false )
			throw new Error( `Loading run #${runId} failed, no rows returned` );

		const retval = new Run();

		retval.runId = result.runId;
		retval.delayAfterCommit = result.delayAfterCommit;
		retval.dependenciesChanged = result.dependenciesChanged;
		retval.duration = result.duration;
		retval.machineId = result.machineId;
		retval.majorErrors = result.majorErrors;
		retval.reason = result.reason;
		retval.timestamp = result.timestamp;
		retval.type = result.type;

		retval._revision = Revision.loadByRevisionId( result.revisionId );

		retval._baselineRun = result.baselineRunId; //( result.baselineRunId !== null ) ? Run.loadByRunId( result.baselineRunId ) : null;
		retval._parentRun = result.parentRunId; //( result.parentRunId !== null ) ? Run.loadByRunId( result.parentRunId ) : null;
		retval._overview = result.overviewId; //( result.overviewId !== null ) ? Overview.loadByRunId( runId ) : null;

		return retval;

	}

	cleanResults() {

		const query = Run.db.prepare( 'DELETE FROM runs2results WHERE runId = ?' );
		const result = query.run( this.runId );

		if ( ! result )
			throw new Error( `Deleting results of run #${this.runId} failed` );

	}

	cleanErrors() {

		const query = Run.db.prepare( 'DELETE FROM errors WHERE runId = ?' );
		const result = query.run( this.runId );

		if ( ! result )
			throw new Error( `Deleting errors of run #${this.runId} failed` );

	}

	/**
	 * Fetch all dependencies, either only those saved in the DB for this particular run
	 * or merged with its base run (default)
	 * @returns {Object.<string, string[]>} An object with HTML files as keys and the code files they depend on as values
	 */
	getDependencies() {

		if ( this.dependenciesChanged === 'false' ) { // augment this run's dependencies with its base

			const baseRevisionId = ( this.baselineRun instanceof Run ) ? this.baselineRun.revisionId : - 1;

			// quick exit
			if ( baseRevisionId === - 1 )
				throw new Error( `Can't resolve dependencies because base run is missing` );

			// JSON_GROUP_ARRAY?
			const query = Run.db.prepare( `SELECT *, filesSrc.name srcFilename, filesDep.name AS depFilename
			FROM dependencies dep1
			LEFT JOIN files filesSrc ON filesSrc.fileId = dep1.srcFileId
			LEFT JOIN files filesDep ON filesDep.fileId = dep1.depFileId
			WHERE
				(dep1.revisionId = $current AND dep1.value IS NOT NULL)
			OR
				(dep1.revisionId = $base AND NOT EXISTS(SELECT * FROM dependencies dep2 WHERE dep2.srcFileId = dep1.srcFileId AND dep2.revisionId = $current))` );

			const result = query.all( { current: this.revisionId, base: baseRevisionId } );

			// doing this via Set()s is easier
			// TODO: Set still needed?
			const depTree = result.reduce( ( all, cur ) => {

				all[ cur.srcFilename ] = all[ cur.srcFilename ] || new Set();

				// if ( cur.value === null )
				// all[ cur.srcFilename ].delete( cur.depFilename );
				// else
				all[ cur.srcFilename ].add( cur.depFilename );

				return all;

			}, {} );

			// even thou they require extra care here
			Object.keys( depTree ).forEach( dep => {

				depTree[ dep ] = [ ...depTree[ dep ] ];

			} );

			return depTree;

		} else { // ignore base, fetch only what's saved for this run in particular

			const query = Run.db.prepare( `SELECT srcFileId, value, filesSrc.name src, JSON_GROUP_ARRAY( filesDep.name ) deps
				FROM dependencies
				LEFT JOIN files filesSrc ON filesSrc.fileId = srcFileId
				LEFT JOIN files filesDep ON filesDep.fileId = depFileId
				WHERE dependencies.revisionId = $current
				GROUP BY srcFileId HAVING value` );

			const result = query.all( { current: this.revisionId } );

			return result.reduce( ( all, cur ) => {

				all[ cur.src ] = JSON.parse( cur.deps );

				return all;

			}, {} );

		}

	}


	/**
	 * Write dependencies to DB. Default mode is to save only entries that differ from the base run.
	 * @param {Object.<string, (string[]|null)>} dependencies Shape { HTML: ([ Source files ]|null) }, NULL'ed entries for deleted files
	 * @param {boolean?} forceAll Write all given dependencies to the DB, without diff'ing to the base run
	 */
	saveDependencies( dependencies, forceAll = false ) {

		if ( this.baselineRun === null || forceAll === true ) {

			// dependenciesChanged as indicator for a full save?
			this.dependenciesChanged = 'true';
			this.save();

			// bit hacky, but we want to be sure all files have a existing DB entry
			// because for some reason this won't work inside the transaction
			// TODO: does this *really* not work with two inserts in a transaction? seems wrong
			for ( const [ html, deps ] of Object.entries( dependencies ) ) {

				let file = new File();
				file.name = html;
				file.save();

				if ( deps === null ) {

					console.error( 'saveDependencies: null in forceAll:', html, 'runId', this.runId );
					continue;

				}

				for ( const filename of deps ) {

					file = new File();
					file.name = filename;
					file.save();

				}

			}

			const sqlInsertDependency = Run.db.prepare( `INSERT OR IGNORE INTO dependencies (revisionId, srcFileId, depFileId, value)
				VALUES ( $revisionId, $srcFileId, (SELECT fileId FROM files WHERE name = $depFilename), 1 )
				ON CONFLICT( revisionId, srcFileId, depFileid ) DO UPDATE SET value = 1` );

			for ( const [ html, deps ] of Object.entries( dependencies ) ) {

				if ( deps === null ) {

					console.error( 'saveDependencies: null in forceAll:', html, 'runId', this.runId );
					continue;

				}

				const srcFileId = File.loadByName( html ).fileId;

				Run.db.transaction( deps => {

					for ( const d of deps ) {

						sqlInsertDependency.run( {
							revisionId: this.revisionId,
							srcFileId,
							depFilename: d
						} );

					}

				} )( deps );

			}

		} else if ( this.baselineRun !== null && forceAll === false ) {

			// dependenciesChanged as indicator for a full save?
			this.dependenciesChanged = 'false';
			this.save();

			// load base dependencies
			const baseDependencies = this.baselineRun.getDependencies();

			const delta = this._createDelta( baseDependencies, dependencies );

			const queryNull = Run.db.prepare( `INSERT INTO dependencies (revisionId, srcFileId, depFileId, value)
				VALUES ( ?, ?, ?, NULL )
				ON CONFLICT( revisionId, srcFileId, depFileid ) DO UPDATE SET value = NULL` );

			// NULL all in-base-but-not-in-child dependencies
			Object.keys( delta.inBaseNotChild ).forEach( srcFile => {

				const source = File.loadByName( srcFile );

				delta.inBaseNotChild[ srcFile ].forEach( depFile => {

					const dependency = File.loadByName( depFile );

					queryNull.run( this.revisionId, source.fileId, dependency.fileId );

				} );

			} );

			const queryAdd = Run.db.prepare( `INSERT INTO dependencies (revisionId, srcFileId, depFileId, value )
			VALUES ( ?, ?, ?, 1 )
			ON CONFLICT( revisionId, srcFileId, depFileid ) DO UPDATE SET value = 1` );

			// add only in-child-but-not-in-base dependencies
			Object.keys( delta.inChildNotBase ).forEach( srcFile => {

				// make sure the file has an entry in the DB
				const hack = new File();
				hack.name = srcFile;
				hack.save();

				const source = hack.fileId; //File.loadByName( srcFile );

				delta.inChildNotBase[ srcFile ].forEach( depFile => {

					// see hack above
					const moreHack = new File();
					moreHack.name = depFile;
					moreHack.save();

					const dependency = moreHack.fileId; //File.loadByName( depFile );

					queryAdd.run( this.revisionId, source, dependency );

				} );

			} );

		} else {

			// debug
			console.error( { baselineRun: this.baselineRun, forceAll } );

		}

	}

	/**
	 * Create a diff between two sets of dependencies
	 * @param {Object.<string, string[]>} baseDependencies
	 * @param {Object.<string, string[]>} childDependencies
	 * @returns {{ inBaseNotChild: (Object.<string, (string[]|null)>|{}), inChildNotBase: (Object.<string, (string[]|null)>|{}) }}
	 */
	_createDelta( baseDependencies, childDependencies ) {

		// probably quicker to solve with some Set() logic
		const inBaseNotChild = {};
		const inChildNotBase = {};

		// everything in base but not in child stays put, unless it's differing - then we ignore base
		Object.keys( baseDependencies ).forEach( srcFile => {

			if ( srcFile in childDependencies === false || childDependencies[ srcFile ] === null ) {

				inBaseNotChild[ srcFile ] = baseDependencies[ srcFile ];

			}
			// diffing deprecated, all dependencies are listed or not required
			/*  else {

				if ( childDependencies[ srcFile ] === null ) { // got deleted in between

					inBaseNotChild[ srcFile ] = baseDependencies[ srcFile ];

				} else {

					const diff = baseDependencies[ srcFile ].filter( d => childDependencies[ srcFile ].includes( d ) === false );
					if ( diff.length > 0 )
						inBaseNotChild[ srcFile ] = diff;

				}

			} */

		} );

		// everything in child dependencies but not in base gets stored in the DB
		Object.keys( childDependencies ).forEach( srcFile => {

			if ( srcFile in baseDependencies === false ) {

				// it's all new, save it
				inChildNotBase[ srcFile ] = childDependencies[ srcFile ];

			} else if ( childDependencies[ srcFile ] !== null ) {

				// it's not new, but we might have updated dependencies
				// check if it's identical
				const sortedBase = baseDependencies[ srcFile ];
				sortedBase.sort();

				const sortedChild = childDependencies[ srcFile ];
				sortedChild.sort();

				if (
					sortedBase.length === sortedChild.length &&
					sortedBase.every( ( d, i ) => sortedChild.indexOf( d ) === i ) &&
					sortedChild.every( ( d, i ) => sortedBase.indexOf( d ) === i )
				)
					return; // identical dependencies, skip
				else
					inChildNotBase[ srcFile ] = childDependencies[ srcFile ]; // something differs, save all

			}

		} );

		return { inBaseNotChild, inChildNotBase };

	}

}


// working around eslint/ts syntax issues
/**
 * @type {import( 'better-sqlite3' ).Database}
 */
Run.db = Database.getConnection();

module.exports = Run;
