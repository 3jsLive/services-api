const Database = require( '../Database' );


class Dependencies {

	/** @typedef {Object.<number, {srcFile: string, srcFileId: number, depFile: string, depFileId: number, active: boolean}>} dependencies */
	/** @typedef {{ all: string[], deleted: string[], modified: string[], added: string[] }} actions */


	/**
	 * @param {number} revisionId
	 * @param {number?} baseRevisionId revision id of base run. if supplied, dependencies will automatically be merged with base run dependencies.
	 * @returns {dependencies}
	 */
	static loadByRevisionId( revisionId, baseRevisionId = - 1 ) {

		let result;

		if ( baseRevisionId > 0 ) {

			const query = Dependencies.db.prepare( `SELECT dep1.*, f1.name AS srcName, f2.name AS depName
				FROM dependencies dep1
				LEFT JOIN files f1 ON f1.fileId = dep1.srcFileId
				LEFT JOIN files f2 ON f2.fileId = dep1.depFileId
				WHERE
					(dep1.revisionId = $current AND dep1.value IS NOT NULL)
				OR
					(dep1.revisionId = $base
						AND NOT EXISTS(
							SELECT 1
							FROM dependencies dep2
							WHERE
								dep2.srcFileId = dep1.srcFileId
							AND
								dep2.depFileId = dep1.depFileId
							AND
								dep2.revisionId = $current
						)
					)` );

			result = query.all( { current: revisionId, base: baseRevisionId } );

		} else {

			const query = Dependencies.db.prepare( `SELECT dep.*, f1.name srcName, f2.name depName
				FROM dependencies dep
				LEFT JOIN files f1 ON f1.fileId = dep.srcFileId
				LEFT JOIN files f2 ON f2.fileId = dep.depFileId
				WHERE dep.revisionId = ?` );

			result = query.all( revisionId );

		}

		if ( ! result || result.length === 0 ) {

			throw new Error( `Couldn't find dependencies with a revisionId of '${revisionId}'` );

		} else {

			const dependencies = result.reduce( ( all, cur ) => {

				all[ cur.dependencyId ] = {
					srcFileId: cur.srcFileId,
					srcFile: cur.srcName,
					depFileId: cur.depFileId,
					depFile: cur.depName,
					active: cur.value === 1
				};

				return all;

			}, {} );

			return dependencies;

		}

	}


	/**
	 * @param {dependencies} dependencies
	 */
	static reformatToSourceBased( dependencies ) {

		// reformat to "source file -> [ list of files it needs ]"
		// not very efficient, but it works
		return Object.keys( dependencies ).reduce( ( all, depId ) => {

			if ( dependencies[ depId ].active === false )
				return all;

			const example = dependencies[ depId ].srcFile;

			all[ example ] = all[ example ] || [];
			all[ example ].push( dependencies[ depId ].depFile );

			all[ example ].sort();

			return all;

		}, {} );

	}


	/**
	 * @param {dependencies} dependencies
	 */
	static reformatToDependencyBased( dependencies ) {

		// reformat to "dependency file -> [ list of source files that need it ]"
		return Object.keys( dependencies ).reduce( ( all, depId ) => {

			if ( dependencies[ depId ].active === false )
				return all;

			const depFile = dependencies[ depId ].depFile;

			all[ depFile ] = all[ depFile ] || [];
			all[ depFile ].push( dependencies[ depId ].srcFile );

			all[ depFile ].sort();

			return all;

		}, {} );

	}


	/**
	 * @param {string} stdout Stdout from git diff command
	 * @returns {actions}
	 */
	static parseGitDiff( stdout ) {

		const actions = { deleted: [], modified: [], added: [], all: [] };

		stdout.trim().split( /\n/g ).reduce( ( all, line ) => {

			const [ status, file1, file2 ] = line.split( /\s+/g );

			if ( /^M[0-9]*$/.test( status ) ) {

				// "Status letter M may be followed by a score[...]"
				all.modified.push( file1 );

			} else if ( status === 'A' ) {

				all.added.push( file1 );

			} else if ( status === 'D' ) {

				all.deleted.push( file1 );

			} else if ( /^R[0-9]*$/.test( status ) ) {

				// "Status letters C and R are always followed by a score[...]"
				all.deleted.push( file1 );
				all.added.push( file2 );

			} else {

				console.log( `No handler for file status: ${line}` );

			}

			return all;

		}, actions );

		// full list with every touched file
		actions.all = [ ...actions.added, ...actions.modified, ...actions.deleted ].filter( ( action, index, arr ) => arr.indexOf( action ) === index );

		actions.all.sort();

		return actions;

	}


	/**
	 * @param {object} dependencies dependencies in dep-based format
	 * @param {actions} actions parsed git diff actions
	 */
	static compareWithGitDiff( dependencies, actions ) {

		// return a list of examples to (re-)test, nothing more for now
		// TODO: switch to actions.modified, .added
		const todo = actions.all.reduce( ( all, touchedFile ) => {

			// obvs skip files we don't know
			if ( touchedFile in dependencies === false ) {

				if ( /^.+?_.+?\.html$/.test( touchedFile ) ) // unless it's an example, then add it
					all.push( touchedFile );

			} else {

				// add everything else (only once thou)
				all.push( ...( dependencies[ touchedFile ].filter( d => all.includes( d ) === false ) ) );

			}

			return all;

		}, [] );

		// order please, order
		todo.sort();

		return todo;

	}

}


// working around eslint/ts syntax issues
/**
 * @type {import( 'better-sqlite3' ).Database}
 */
Dependencies.db = Database;


module.exports = Dependencies;
