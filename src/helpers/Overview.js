const Database = require( '../Database' );

class Overview {

	constructor() {

		this.overviewId = - 1;
		this.overviewJson = {};

	}

	static loadByRunId( runId ) {

		const query = Overview.db.prepare( 'SELECT overviewId FROM runs WHERE runId = ? LIMIT 1' );
		const result = query.get( runId );

		if ( ! result || 'overviewId' in result === false )
			throw new Error( `Loading overview of run #${runId} failed, run not found` );

		return Overview.loadById( result.overviewId );

	}

	static loadById( overviewId ) {

		const query = Overview.db.prepare( 'SELECT * FROM overviews WHERE overviewId = ? LIMIT 1' );
		const result = query.get( overviewId );

		if ( ! result || 'overviewId' in result === false || 'overviewJson' in result === false )
			throw new Error( `Loading overview #${overviewId} failed, no rows returned` );

		const retval = new Overview();
		retval.overviewId = result.overviewId;
		retval.overviewJson = JSON.parse( result.overviewJson );

		return retval;

	}

	static loadByJson( json ) {

		const query = Overview.db.prepare( 'SELECT * FROM overviews WHERE overviewJson = ? LIMIT 1' );
		const result = query.get( json );

		if ( ! result || 'overviewId' in result === false || 'overviewJson' in result === false )
			throw new Error( `Loading overview failed, no rows returned` );

		const retval = new Overview();
		retval.overviewId = result.overviewId;
		retval.overviewJson = JSON.parse( result.overviewJson );

		return retval;

	}

	save() {

		if ( this.overviewId > 0 ) {

			this._update();

		} else {

			this._insert();

		}

	}

	_insert() {

		const query = Overview.db.prepare( `INSERT INTO overviews ( overviewJson ) VALUES ( $overviewJson )` );

		const result = query.run( { ...this } );

		if ( result.changes !== 1 )
			Object.assign( this, Overview.loadByJson( this.overviewJson ) ); // hax
		else
			this.overviewId = result.lastInsertRowid;

	}

	_update() {

		const query = Overview.db.prepare( `UPDATE overviews SET overviewJson = $overviewJson WHERE overviewId = $overviewId` );

		const result = query.run( { ...this } );

		if ( result.changes !== 1 )
			throw new Error( `Couldn't save overview` );

	}

}

// working around eslint/ts syntax issues
Overview.db = Database.db;

module.exports = Overview;
