const fs = require( 'fs' );
const sqlite = require( 'better-sqlite3' );

const t = require( 'tap' );

const testDatabase = new sqlite( `tests`, { memory: true } );
require( '../src/Database' )( testDatabase ); // rigging

const dbSchema = fs.readFileSync( `${__dirname}/../src/schema.sql`, 'utf8' );
const dbData = fs.readFileSync( `${__dirname}/helpers/File/data.sql`, 'utf8' );

const File = require( '../src/helpers/File' );


t.test( `helpers / File`, t => {

	t.beforeEach( ( done/* , t */ ) => {

		testDatabase.exec( `PRAGMA foreign_keys = '0';` );
		testDatabase.exec( dbSchema );
		testDatabase.exec( dbData );
		testDatabase.exec( `PRAGMA foreign_keys = '1';` );

		done();

	} );

	t.test( 'loadBy*', t => {

		const file1 = File.loadByFileId( 1 );
		const file2 = File.loadByName( 'example1' );

		t.strictEqual( file1.fileId, 1 );
		t.strictEqual( file1.name, 'example1' );
		t.strictSame( file1, file2 );

		const file3 = File.loadByFileId( 2 );
		t.notStrictSame( file1, file3 );

		t.throws( () => File.loadByFileId( 999 ), { name: 'Error' } );
		t.throws( () => File.loadByName( 'does not exist' ), { name: 'Error' } );

		t.end();

	} );

	t.test( 'loadAll, success', t => {

		const files = File.loadAll();

		t.strictEqual( files.length, 3 );

		t.ok( files[ 0 ] instanceof File );
		t.ok( files[ 1 ] instanceof File );
		t.ok( files[ 2 ] instanceof File );

		t.strictEqual( files[ 0 ].fileId, 1 );
		t.strictEqual( files[ 0 ].name, 'example1' );

		t.end();

	} );

	t.test( 'loadAll, failure', t => {

		testDatabase.exec( 'DELETE FROM files WHERE 1' );

		t.doesNotThrow( () => File.loadAll() );

		const noFiles = File.loadAll();
		t.strictSame( noFiles, [] );

		t.end();

	} );

	t.test( 'save', t => {

		const fileNew = new File();
		fileNew.name = 'new file';
		fileNew.save();

		const fileNewCheck = File.loadByName( 'new file' );

		t.strictSame( fileNewCheck, fileNew );

		t.strictEqual( fileNew.fileId, 4 );
		t.strictEqual( fileNew.name, 'new file' );

		t.end();

	} );

	t.end();

} );
