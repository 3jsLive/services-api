const fs = require( 'fs' );
const path = require( 'path' );
const sqlite = require( 'better-sqlite3' );
const shell = require( 'shelljs' );
const assert = require( 'assert' );

const pathDb = `${__dirname}/dependencies/test.db`;
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


describe( `dependencies`, function () {

	before( 'setup DB', function () {

		this.timeout( 30000 );

		const pathSchema = `${__dirname}/../src/schema.sql`;
		const pathData = `${__dirname}/dependencies/data.sql`;
		const pathDataGz = pathData + '.gz';

		// blind hope that gunzip is installed
		shell.exec( `gunzip --keep --force ${pathDataGz}`, { cwd: `${__dirname}/dependencies/`, silent: true } );

		const dbSchema = fs.readFileSync( pathSchema, 'utf8' );
		const dbData = fs.readFileSync( pathData, 'utf8' );

		apiDatabase.pragma( 'foreign_keys = 0', { simple: true } );

		apiDatabase.exec( dbSchema );
		apiDatabase.exec( dbData );

		apiDatabase.pragma( 'foreign_keys = 1', { simple: true } );

	} );

	after( 'cleanup', function () {

		this.timeout( 30000 );

		apiDatabase.close();

		const files = [
			`${__dirname}/dependencies/data.sql`,
			pathDb,
			pathDb + '-shm',
			pathDb + '-wal',
		];

		shell.rm( files );

	} );

	describe( 'getDependencies', function () {

		const gold = require( `${__dirname}/dependencies/gold.js` );

		for ( const [ sha, goldDeps ] of Object.entries( gold ) ) {

			it( sha, function () {

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

				assert.strictEqual( ret, goldDeps.result );

				if ( 'todo' in goldDeps ) {

					goldDeps.todo.sort();
					assert.deepEqual( JSON.parse( retval ), goldDeps.todo );

				}

			} );

		}

	} );

} );
