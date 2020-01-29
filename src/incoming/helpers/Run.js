const Database = require( '../Database' );

const Revision = require( './Revision' );
const Overview = require( './Overview' );

class Run {

	// #revision
	// #baselineRun
	// #parentRun
	// #overview

	constructor() {

		this.runId = - 1;
		// this.revisionId = - 1;
		this.timestamp = - 1;
		this.duration = - 1;
		this.delayAfterCommit = - 1;
		this.reason = '';
		// this.baselineRunId = null;
		// this.parentRunId = null;
		this.dependenciesChanged = '';
		this.machineId = 1;
		this.majorErrors = 0;
		// this.overviewId = null;
		this.type = null;

		this._revision = null;
		this._baselineRun = null;
		this._parentRun = null;
		this._overview = null;

	}

	set baselineRunId( value ) {

		if ( value === null ) {

			this._baselineRun = null;

		} else if ( Number.isInteger( value ) && value > 0 ) {

			if ( ! this._baselineRun || ( this._baselineRun && this._baselineRun.runId !== value ) ) {

				this._baselineRun = Run.loadByRunId( value );

			}

		} else {

			throw new Error( 'Invalid value for baselineRunId:', value );

		}

	}

	get baselineRunId() {

		if ( this._baselineRun ) {

			return this._baselineRun.runId;

		} else {

			return null;

		}

	}

	/**
	 * @type {Run}
	 */
	get baselineRun() {

		return this._baselineRun;

	}

	set baselineRun( value ) {

		if ( value instanceof Run || value === null ) {

			this._baselineRun = value;

		} else {

			throw new Error( 'Invalid value for baselineRun:', value );

		}

	}

	set parentRunId( value ) {

		if ( value === null ) {

			this._parentRun = null;

		} else if ( Number.isInteger( value ) && value > 0 ) {

			if ( ! this._parentRun || ( this._parentRun && this._parentRun.runId !== value ) ) {

				this._parentRun = Run.loadByRunId( value );

			}

		} else {

			throw new Error( 'Invalid value for parentRunId:', value );

		}

	}

	get parentRunId() {

		if ( this._parentRun ) {

			return this._parentRun.runId;

		} else {

			return null;

		}

	}

	get parentRun() {

		return this._parentRun;

	}

	set parentRun( value ) {

		if ( value instanceof Run || value === null ) {

			this._parentRun = value;

		} else {

			throw new Error( 'Invalid value for parentRun:', value );

		}

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

	set overviewId( value ) {

		if ( value === null ) {

			this._overview = null;

		} else if ( Number.isInteger( value ) && value > 0 ) {

			if ( ! this._overview || ( this._overview && this._overview.overviewId !== value ) ) {

				this._overview = Overview.loadById( value );

			}

		} else {

			throw new Error( 'Invalid value for overviewId:', value );

		}

	}

	get overviewId() {

		if ( this._overview ) {

			return this._overview.overviewId;

		} else {

			return null;

		}

	}

	get overview() {

		return this._overview;

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

	static loadByRevisionId( revisionId ) {

		const query = Run.db.prepare( `SELECT runId FROM runs WHERE revisionId = ? LIMIT 1` );
		const result = query.get( revisionId );

		if ( ! result || 'runId' in result === false )
			throw new Error( `Couldn't find a run with a revisionId of '${revisionId}'` );
		else
			return Run.loadByRunId( result.runId );

	}

	static loadByRunId( runId ) {

		const query = Run.db.prepare( 'SELECT * FROM runs WHERE runId = ? LIMIT 1' );
		const result = query.get( runId );

		if ( ! result || 'runId' in result === false )
			throw new Error( `Loading run #${runId} failed, no rows returned` );

		const retval = new Run();
		Object.assign( retval, result ); // hacky

		return retval;

	}

}

// working around eslint/ts syntax issues
Run.db = Database.getConnection();

module.exports = Run;
