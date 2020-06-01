const fs = require( 'fs' );
const path = require( 'path' );
const sqlite = require( 'better-sqlite3' );

const t = require( 'tap' );
const sinon = require( 'sinon' );



// ghetto mock
const sendSpy = sinon.spy();

const res = {
	status: () => ( {
		contentType: () => ( {
			send: sendSpy
		} )
	} )
};


const gold = require( `${__dirname}/dependencies/gold.js` );
const gold_getBase = JSON.parse( fs.readFileSync( `${__dirname}/dependencies/gold-getBase.json`, 'utf8' ) );


t.test( `dependencies`, t => {

	const pathDb = `${__dirname}/dependencies/test.db`;
	const pathSchema = `${__dirname}/../src/schema.sql`;
	const pathData = `${__dirname}/dependencies/data.sql`;
	const pathDataGz = pathData + '.gz';

	const apiDatabase = new sqlite( pathDb );

	const Database = require( '../src/Database' );
	Database.db = apiDatabase;

	const trueConfig = require( 'rc' )( '3cidev' );

	// hax
	process.env = {
		...process.env,
		'3cidev_root': `/`,
		'3cidev_threejsRepository': path.join( trueConfig.root, trueConfig.threejsRepository ),
		'3cidev_api__database': pathDb
	};

	const History = require( '../src/helpers/History' );
	const getBaseHistoryStub = sinon.stub( History, 'getBase' ).callThrough();

	const shell = require( 'shelljs' );
	const execShellStub = sinon.stub( shell, 'exec' ).callThrough();

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

		for ( const [ sha, goldDeps ] of Object.entries( gold ) ) {

			t.test( `${sha}: ${goldDeps.message}`, t => {

				const ret = dependencies.getDependencies( { params: { sha: sha } }, res );

				t.strictEqual( ret, goldDeps.result, `correct result: ${goldDeps.result}` );

				if ( 'todo' in goldDeps ) {

					goldDeps.todo.sort();

					const json = JSON.parse( sendSpy.args[ 0 ][ 0 ] );

					t.deepEqual( json, goldDeps.todo, `correct todo list - Expected: ${goldDeps.todo.length} Actual: ${json.length}` );

				}

				sendSpy.resetHistory();

				t.end();

			} );

		}


		t.test( 'git diff/shell.exec returns code !== 0, send everything', t => {

			execShellStub
				.withArgs( sinon.match( /^git diff --name-status [a-f0-9]{40} ac6ff1d276a5a7811f156860645efea8db8e7fed$/ ) )
				.returns( { code: 23 } );

			const retval = dependencies.getDependencies( { params: { sha: 'ac6ff1d276a5a7811f156860645efea8db8e7fed' } }, res );
			const json = JSON.parse( sendSpy.args[ 0 ][ 0 ] );

			t.strictEqual( retval, false, 'returns false' );
			t.strictDeepEqual( json, gold_getBase, 'correct todo list' );

			execShellStub.restore();
			sendSpy.resetHistory();

			t.end();

		} );


		t.test( 'getBase fails, send everything', t => {

			getBaseHistoryStub.throws( 'Foo' );

			const retval = dependencies.getDependencies( { params: { sha: 'ac6ff1d276a5a7811f156860645efea8db8e7fed' } }, res );
			const json = JSON.parse( sendSpy.args[ 0 ][ 0 ] );

			t.strictEqual( retval, false, 'returns false' );
			t.strictDeepEqual( json, gold_getBase, 'correct todo list' );

			getBaseHistoryStub.resetBehavior();
			sendSpy.resetHistory();

			t.end();

		} );


		t.test( 'getParent returns false, send everything', t => {

			getBaseHistoryStub.returns( false );

			const retval = dependencies.getDependencies( { params: { sha: 'ac6ff1d276a5a7811f156860645efea8db8e7fed' } }, res );
			const json = JSON.parse( sendSpy.args[ 0 ][ 0 ] );

			t.strictEqual( retval, false, 'returns false' );
			t.strictDeepEqual( json, gold_getBase, 'correct todo list' );

			getBaseHistoryStub.resetBehavior();
			sendSpy.resetHistory();

			t.end();

		} );

		t.end();

	} );


	t.tearDown( () => {

		apiDatabase.close();

		const files = [
			`${__dirname}/dependencies/data.sql`,
			pathDb,
			pathDb + '-shm',
			pathDb + '-wal',
		];

		shell.rm( files );

	} );


	t.end();

} );
