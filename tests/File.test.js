const fs = require( 'fs' );
const sqlite = require( 'better-sqlite3' );

const assert = require( 'assert' );

const testDatabase = new sqlite( `tests`, { memory: true } );
const Database = require( '../src/Database' ); // rigging
Database._db = testDatabase;

const dbSchema = fs.readFileSync( `${__dirname}/../src/schema.sql`, 'utf8' );
const dbData = fs.readFileSync( `${__dirname}/helpers/File/data.sql`, 'utf8' );

const File = require( '../src/helpers/File' );


describe( `helpers / File`, function () {

	beforeEach( 'clean slate', function () {

		testDatabase.exec( `PRAGMA foreign_keys = '0';` );
		testDatabase.exec( dbSchema );
		testDatabase.exec( dbData );
		testDatabase.exec( `PRAGMA foreign_keys = '1';` );

	} );

	it( 'loadBy*', function () {

		const file1 = File.loadByFileId( 1 );
		const file2 = File.loadByName( 'example1' );

		assert.strictEqual( file1.fileId, 1 );
		assert.strictEqual( file1.name, 'example1' );
		assert.deepStrictEqual( file1, file2 );

		const file3 = File.loadByFileId( 2 );
		assert.notDeepStrictEqual( file1, file3 );

		assert.throws( () => File.loadByFileId( 999 ), { name: 'Error' } );
		assert.throws( () => File.loadByName( 'does not exist' ), { name: 'Error' } );

	} );

	it( 'loadAll, success', function () {

		const files = File.loadAll();

		assert.strictEqual( files.length, 3 );

		assert.ok( files[ 0 ] instanceof File );
		assert.ok( files[ 1 ] instanceof File );
		assert.ok( files[ 2 ] instanceof File );

		assert.strictEqual( files[ 0 ].fileId, 1 );
		assert.strictEqual( files[ 0 ].name, 'example1' );

	} );

	it( 'loadAll, failure', function () {

		testDatabase.exec( 'DELETE FROM files WHERE 1' );

		assert.doesNotThrow( () => File.loadAll() );

		const noFiles = File.loadAll();
		assert.deepStrictEqual( noFiles, [] );

	} );

	it( 'save', function () {

		const fileNew = new File();
		fileNew.name = 'new file';
		fileNew.save();

		const fileNewCheck = File.loadByName( 'new file' );

		assert.deepStrictEqual( fileNewCheck, fileNew );

		assert.strictEqual( fileNew.fileId, 4 );
		assert.strictEqual( fileNew.name, 'new file' );

	} );

} );
