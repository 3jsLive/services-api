const fs = require( 'fs' );
const path = require( 'path' );
const sqlite = require( 'better-sqlite3' );
const shell = require( 'shelljs' );

const t = require( 'tap' );


t.test( `dependencies`, t => {

	const pathDb = `${__dirname}/dependencies/test.db`;
	const pathSchema = `${__dirname}/../src/schema.sql`;
	const pathData = `${__dirname}/dependencies/data.sql`;
	const pathDataGz = pathData + '.gz';

	const apiDatabase = new sqlite( pathDb );

	const Database = require( '../src/Database' );
	Database._db = apiDatabase;

	const trueConfig = require( 'rc' )( '3cidev' );

	// hax
	process.env = {
		...process.env,
		'3cidev_root': `/`,
		'3cidev_threejsRepository': path.join( trueConfig.root, trueConfig.threejsRepository ),
		'3cidev_api__database': pathDb
	};
	const dependencies = require( '../src/dependencies/dependencies' );

	// blind hope that gunzip is installed
	shell.exec( `gunzip --keep --force ${pathDataGz}`, { cwd: `${__dirname}/dependencies/`, silent: true } );

	const dbSchema = fs.readFileSync( pathSchema, 'utf8' );
	const dbData = fs.readFileSync( pathData, 'utf8' );

	apiDatabase.pragma( 'foreign_keys = 0', { simple: true } );

	apiDatabase.exec( dbSchema );
	apiDatabase.exec( dbData );

	apiDatabase.pragma( 'foreign_keys = 1', { simple: true } );

	t.test( 'getDependencies', t => {

		const gold = require( `${__dirname}/dependencies/gold.js` );

		for ( const [ sha, goldDeps ] of Object.entries( gold ) ) {

			t.test( sha, t => {

				let retval = '';

				// ghetto mock
				const res = {
					status: () => ( {
						contentType: () => ( {
							send: ( val ) => {

								retval = val;

							}
						} ),
						send: ( val ) => {

							retval = val;

						}
					} )
				};

				const ret = dependencies.getDependencies( { params: { sha: sha } }, res );

				t.strictEqual( ret, goldDeps.result );

				if ( 'todo' in goldDeps ) {

					goldDeps.todo.sort();
					t.deepEqual( JSON.parse( retval ), goldDeps.todo );

				}

				t.end();

			} );

		}

		t.end();

	} );

	apiDatabase.close();

	const files = [
		`${__dirname}/dependencies/data.sql`,
		pathDb,
		pathDb + '-shm',
		pathDb + '-wal',
	];

	shell.rm( files );

	t.end();

} );
