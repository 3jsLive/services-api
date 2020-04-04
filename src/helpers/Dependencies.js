const Database = require( '../Database' );
const File = require( './File' );


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


	/**
	 * Write dependencies to DB. Default mode is to save only entries that differ from the base run.
	 * @param {number} revisionId Revision ID of child
	 * @param {Object.<string, (string[]|null)>} dependencies Shape { HTML: ([ Source files ]|null) }, NULL'ed entries for deleted files
	 * @param {Object.<string, string[]>?} baseDependencies
	 */
	static saveDependencies( revisionId, dependencies, baseDependencies = null ) {

		if ( baseDependencies === null ) {

			const sqlInsertDependency = Dependencies.db.prepare( `INSERT OR IGNORE INTO dependencies (revisionId, srcFileId, depFileId, value)
				VALUES ( $revisionId, $srcFileId, (SELECT fileId FROM files WHERE name = $depFilename), 1 )
				ON CONFLICT( revisionId, srcFileId, depFileid ) DO UPDATE SET value = 1` );

			for ( const [ html, deps ] of Object.entries( dependencies ) ) {

				if ( deps === null ) {

					console.error( 'saveDependencies: null in forceAll:', html, 'runId', this.runId );
					continue;

				}

				Dependencies.db.transaction( deps => {

					// bit hacky, but we want to be sure all files have a existing DB entry
					const source = new File();
					source.name = html;
					source.save();

					for ( const depFilename of deps ) {

						const dependency = new File();
						dependency.name = depFilename;
						dependency.save();

						sqlInsertDependency.run( {
							revisionId,
							srcFileId: source.fileId,
							depFilename
						} );

					}

				} )( deps );

			}

		} else {

			const delta = Dependencies._createDelta( dependencies, baseDependencies );

			const querySet = Dependencies.db.prepare( `INSERT INTO dependencies (revisionId, srcFileId, depFileId, value)
				VALUES (
					$revisionId,
					( SELECT fileId FROM files WHERE name = $srcFilename ),
					( SELECT fileId FROM files WHERE name = $depFilename ),
					$value
				) ON CONFLICT ( revisionId, srcFileId, depFileid ) DO UPDATE SET value = $value` );

			Dependencies.db.transaction( srcDepVal => {

				for ( const d of srcDepVal ) {

					const src = new File();
					src.name = d.source;
					src.save();

					const dep = new File();
					dep.name = d.dependency;
					dep.save();

					querySet.run( { revisionId, srcFilename: d.source, depFilename: d.dependency, value: d.value } );

				}

			} )( delta );

		}

	}


	/**
	 * Create a diff between two sets of source-formatted dependencies
	 * @param {Object.<string, string[]>} childDependencies
	 * @param {Object.<string, string[]>} baseDependencies
	 * @returns {Array.<{ source: string, dependency: string, value: (number|null)}>} Array of source-dependency-value objects
	 */
	static _createDelta( childDependencies, baseDependencies ) {

		const diff = [];

		// everything in base but not in child stays put, unless it's differing - then we ignore base
		Object.keys( baseDependencies ).forEach( srcFile => {

			if ( srcFile in childDependencies === false ) {

				// ignore
				// console.log( srcFile, 'is in base but not in child' );

			} else if ( childDependencies[ srcFile ] === null ) {

				// example deleted
				const changes = baseDependencies[ srcFile ].map( dep => {

					return { source: srcFile, dependency: dep, value: null };

				} );

				diff.push( ...changes );

			} else {

				const inBaseNotChild = baseDependencies[ srcFile ].filter( d => childDependencies[ srcFile ].includes( d ) === false );

				const changes = [
					...inBaseNotChild.map( d => ( { source: srcFile, dependency: d, value: null } ) )
				];

				diff.push( ...changes );

			}

		} );

		// everything in child dependencies but not in base gets stored in the DB
		Object.keys( childDependencies ).forEach( srcFile => {

			if ( srcFile in baseDependencies === false ) {

				// it's all new, save it
				const changes = childDependencies[ srcFile ].map( d => ( { source: srcFile, dependency: d, value: 1 } ) );

				diff.push( ...changes );

			} else if ( childDependencies[ srcFile ] !== null ) {

				// it's not new, we might have updated dependencies
				const inChildNotBase = childDependencies[ srcFile ].filter( d => baseDependencies[ srcFile ].includes( d ) === false );

				const changes = [
					...inChildNotBase.map( d => ( { source: srcFile, dependency: d, value: 1 } ) )
				];

				diff.push( ...changes );

			}

		} );

		return diff;

	}

}


// working around eslint/ts syntax issues
/**
 * @type {import( 'better-sqlite3' ).Database}
 */
Dependencies.db = Database.db;


module.exports = Dependencies;
