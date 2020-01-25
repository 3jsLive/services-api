const Database = require( '../Database' );

const Revision = require( './Revision' );
const Overview = require( './Overview' );

class Run {

	#revision
	#baselineRun
	#parentRun
	#overview

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

		this.#revision = null;
		this.#baselineRun = null;
		this.#parentRun = null;
		this.#overview = null;

	}

	set baselineRunId( value ) {

		if ( value === null ) {

			this.#baselineRun = null;

		} else if ( Number.isInteger( value ) && value > 0 ) {

			if ( ! this.#baselineRun || ( this.#baselineRun && this.#baselineRun.runId !== value ) ) {

				this.#baselineRun = Run.loadByRunId( value );

			}

		} else {

			throw new Error( 'Invalid value for baselineRunId:', value );

		}

	}

	get baselineRunId() {

		if ( this.#baselineRun ) {

			return this.#baselineRun.runId;

		} else {

			return null;

		}

	}

	get baselineRun() {
		return this.#baselineRun;
	}

	set baselineRun( value ) {

		if ( value instanceof Run || value === null ) {

			this.#baselineRun = value;

		} else {

			throw new Error( 'Invalid value for baselineRun:', value );

		}

	}

	set parentRunId( value ) {

		if ( value === null ) {

			this.#parentRun = null;

		} else if ( Number.isInteger( value ) && value > 0 ) {

			if ( ! this.#parentRun || ( this.#parentRun && this.#parentRun.runId !== value ) ) {

				this.#parentRun = Run.loadByRunId( value );

			}

		} else {

			throw new Error( 'Invalid value for parentRunId:', value );

		}

	}

	get parentRunId() {

		if ( this.#parentRun ) {

			return this.#parentRun.runId;

		} else {

			return null;

		}

	}

	get parentRun() {
		return this.#parentRun;
	}

	set parentRun( value ) {

		if ( value instanceof Run || value === null ) {

			this.#parentRun = value;

		} else {

			throw new Error( 'Invalid value for parentRun:', value );

		}			

	}

	set revisionId( value ) {

		if ( value === null ) {

			this.#revision = null;

		} else if ( Number.isInteger( value ) && value > 0 ) {

			if ( ! this.#revision || ( this.#revision && this.#revision.revisionId !== value ) ) {

				this.#revision = Revision.loadByRevisionId( value );

			}

		} else {

			throw new Error( 'Invalid value for revisionId:', value );

		}

	}

	get revisionId() {

		if ( this.#revision ) {

			return this.#revision.revisionId;

		} else {

			return null;

		}

	}

	get revision() {

		return this.#revision;

	}

	set revision( value ) {

		if ( value instanceof Revision || value === null ) {

			this.#revision = value;

		} else {

			throw new Error( 'Invalid value for revision:', value );

		}			

	}

	set overviewId( value ) {

		if ( value === null ) {

			this.#overview = null;

		} else if ( Number.isInteger( value ) && value > 0 ) {

			if ( ! this.#overview || ( this.#overview && this.#overview.overviewId !== value ) ) {

				this.#overview = Overview.loadById( value );

			}

		} else {

			throw new Error( 'Invalid value for overviewId:', value );

		}

	}

	get overviewId() {

		if ( this.#overview ) {

			return this.#overview.overviewId;

		} else {

			return null;

		}

	}

	get overview() {

		return this.#overview;

	}

	set overview( value ) {

		if ( value instanceof Overview || value === null ) {

			this.#overview = value;

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
