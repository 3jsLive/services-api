const Database = require( '../Database' );

const Dependencies = require( './Dependencies' );
const Revision = require( './Revision' );
const Overview = require( './Overview' );
const Results = require( './Results' );

class Run {

	constructor() {

		this.runId = - 1;
		this.timestamp = - 1;
		this.duration = - 1;
		this.delayAfterCommit = - 1;
		this.reason = '';
		this.fullSizeEntry = '';
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
				baselineRunId, parentRunId, fullSizeEntry, machineId,
				majorErrors, overviewId, type)
			VALUES
			( $revisionId, $timestamp, $duration, $delayAfterCommit, $reason,
				$baselineRunId, $parentRunId, $fullSizeEntry, $machineId,
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
			baselineRunId = $baselineRunId, parentRunId = $parentRunId, fullSizeEntry = $fullSizeEntry, machineId = $machineId,
			majorErrors = $majorErrors, overviewId = $overviewId, type = $type
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
		retval.fullSizeEntry = result.fullSizeEntry;
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

		// augment this run's dependencies with its base
		if ( this.fullSizeEntry === 'false' ) {

			const baseRevisionId = ( this.baselineRun instanceof Run ) ? this.baselineRun.revisionId : - 1;

			// quick exit
			if ( baseRevisionId === - 1 )
				throw new Error( `Can't resolve dependencies because base run is missing` );

			const deps = Dependencies.loadByRevisionId( this.revisionId, baseRevisionId );

			return Dependencies.reformatToSourceBased( deps );

		} else {

			// ignore base, fetch only what's saved for this run in particular
			const deps = Dependencies.loadByRevisionId( this.revisionId );

			return Dependencies.reformatToSourceBased( deps );

		}

	}


	/**
	 * Write dependencies to DB. Default mode is to save only entries that differ from the base run.
	 * @param {Object.<string, (string[]|null)>} dependencies Shape { HTML: ([ Source files ]|null) }, NULL'ed entries for deleted files
	 * @param {boolean?} forceAll Write all given dependencies to the DB, without diff'ing to the base run
	 */
	saveDependencies( dependencies, forceAll = false ) {

		if ( this.baselineRun === null || forceAll === true ) {

			// fullSizeEntry as flag for a full save
			this.fullSizeEntry = 'true';
			this.save();

			Dependencies.saveDependencies( this.revisionId, dependencies );

		} else {

			this.fullSizeEntry = 'false';
			this.save();

			Dependencies.saveDependencies( this.revisionId, dependencies, this.baselineRun.getDependencies() );

		}

	}


	/**
	 * Fetch all results, either only those saved in the DB for this particular run if it's a fullSizeEntry
	 * or merged with its base run if not
	 * @returns {import('./Results').deepResult[]} An object with HTML files as keys and the code files they depend on as values
	 */
	getResults() {

		if ( this.fullSizeEntry === 'true' ) {

			return Results.loadByRunId( this.runId );

		} else {

			if ( this.baselineRunId === null || this.baselineRunId <= 0 )
				throw new Error( `#${this.runId} is not a fullSizeEntry but has no valid baselineRunId: #${this.baselineRunId}` );

			return Results.loadByRunId( this.runId, this.baselineRunId );

		}

	}

	// saveResults //TODO:

}


// working around eslint/ts syntax issues
/**
 * @type {import( 'better-sqlite3' ).Database}
 */
Run.db = Database.db;

module.exports = Run;
