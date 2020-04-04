const Database = require( '../Database' );


class Results {

	/** @typedef {Object.<number, {resultId: number, testId: number, fileId: number, value: any}>} flatResult */
	/** @typedef {Object.<number, {resultId: number, testId: number, fileId: number, value: any, runId: number}>} deepResult */


	/**
	 * @param {number} runId
	 * @param {number?} baseRunId id of base run: if supplied, current results will automatically be merged with the base run's results.
	 * @returns {deepResult}
	 */
	static loadByRunId( runId, baseRunId = - 1 ) {

		let result;

		if ( baseRunId > 0 ) {

			const query = Results.db.prepare( `SELECT r2r1.r2rId, r2r1.runId, r2r1.resultId, r1.testId, r1.fileId, r1.value
			FROM runs2results r2r1
			LEFT JOIN results r1 USING(resultId)
			WHERE
				(r2r1.runId = $current AND r1.value IS NOT NULL)
			OR
				(r2r1.runId = $base
					AND NOT EXISTS(
						SELECT 1
						FROM runs2results r2r2
						LEFT JOIN results r2 USING(resultId)
						WHERE
							r2r2.runId = $current
						AND
							r1.testId = r2.testId
						AND
							r1.fileId = r2.fileId
					)
				)` );

			result = query.all( { current: runId, base: baseRunId } );

		} else {

			const query = Results.db.prepare( `SELECT results.*, runs2results.*
				FROM results
				LEFT JOIN runs2results USING(resultId)
				WHERE runs2results.runId = ?` );

			result = query.all( runId );

		}

		if ( ! result || result.length === 0 ) {

			throw new Error( `Couldn't find results with for run #${runId}` );

		} else {

			const results = result.reduce( ( all, cur ) => {

				all[ cur.resultId ] = {
					testId: cur.testId,
					fileId: cur.fileId,
					value: cur.value,
					runId: cur.runId
				};

				return all;

			}, {} );

			return results;

		}

	}


	/**
	 * @param {(flatResult|deepResult)} results
	 */
	static reformatToFileBased( results ) {

		// reformat to "file -> [ all results for this file ]"
		return Object.keys( results ).reduce( ( all, resultId ) => {

			const fileId = results[ resultId ].fileId;

			all[ fileId ] = all[ fileId ] || [];
			all[ fileId ].push( results[ resultId ] );

			all[ fileId ].sort( ( a, b ) => a.testId - b.testId ); // crude

			return all;

		}, {} );

	}


	/**
	 * @param {(flatResult|deepResult)} results
	 */
	static reformatToTestBased( results ) {

		// reformat to "test -> [ all results for this test ]"
		return Object.keys( results ).reduce( ( all, resultId ) => {

			const testId = results[ resultId ].testId;

			all[ testId ] = all[ testId ] || [];
			all[ testId ].push( results[ resultId ] );

			all[ testId ].sort( ( a, b ) => a.fileId - b.fileId ); // at least somewhat consistent

			return all;

		}, {} );

	}


	/**
	 * Write results to DB. Default mode is to save only entries that differ from the base run.
	 * @param {number} runId
	 * @param {number} testId
	 * @param {number} fileId
	 * @param {any} value
	 * @param {number?} baseRunId optional
	 */
	static saveResult( runId, testId, fileId, value, baseRunId = - 1 ) {

		const sqlInsertResult = Results.db.prepare( `INSERT OR IGNORE INTO results ( testId, fileId, value ) VALUES ( ?, ?, ? )` );

		if ( baseRunId === - 1 ) {

			const sqlInsertRun2Result = Results.db.prepare( `INSERT OR IGNORE INTO runs2results ( runId, resultId ) VALUES ( ?, (
				SELECT resultId FROM results WHERE testId = ? AND fileId = ? AND value = ?
			) )` );

			sqlInsertResult.run( testId, fileId, value );
			sqlInsertRun2Result.run( runId, testId, fileId, value );

		} else {

			sqlInsertResult.run( testId, fileId, value );

			const sqlInsertIfDifferent = Results.db.prepare( `INSERT INTO runs2results ( runId, resultId )
				SELECT $runId, ( SELECT resultId FROM results WHERE testId = $testId AND fileId = $fileId AND value = $value )
				WHERE
					NOT EXISTS(
						SELECT 1 FROM runs2results
						WHERE
							runId = $baseRunId
							AND
							resultId = ( SELECT resultId FROM results WHERE testId = $testId AND fileId = $fileId AND value = $value )
					)` );

			sqlInsertIfDifferent.run( { runId, testId, fileId, value, baseRunId } );

		}

	}


	// static saveResults( runId, results, baseRunId = - 1 ) {

	// }

}


// working around eslint/ts syntax issues
/**
 * @type {import( 'better-sqlite3' ).Database}
 */
Results.db = Database.db;


module.exports = Results;
