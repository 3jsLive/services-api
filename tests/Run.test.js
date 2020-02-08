const fs = require( 'fs' );
const sqlite = require( 'better-sqlite3' );

const assert = require( 'assert' );

const testDatabase = new sqlite( `tests`, { memory: true } );
const Database = require( '../src/Database' ); // rigging
Database._db = testDatabase;

const dbSchema = fs.readFileSync( `${__dirname}/../src/schema.sql`, 'utf8' );
const dbData = fs.readFileSync( `${__dirname}/helpers/Run/data.sql`, 'utf8' );

const Run = require( '../src/helpers/Run' );
const Revision = require( '../src/helpers/Revision' );
const Overview = require( '../src/helpers/Overview' );


describe( `helpers / Run`, function () {

	beforeEach( 'clean slate', function () {

		testDatabase.exec( `PRAGMA foreign_keys = '0';` );
		testDatabase.exec( dbSchema );
		testDatabase.exec( dbData );
		testDatabase.exec( `PRAGMA foreign_keys = '1';` );

	} );

	describe( 'Setters/Getters', function () {

		beforeEach( 'Setup', function () {

			this.run = Run.loadByRunId( 1 );

		} );

		it( 'revision', function () {

			// Getter
			const revision = this.run.revision;
			const gold = Revision.loadByRevisionId( 1 );

			assert.deepEqual( revision, gold );

			// Setter
			assert.throws( () => {

				this.run.revision = {};

			}, { name: 'Error' } );

			assert.doesNotThrow( () => {

				this.run.revision = null;

			} );

			assert.doesNotThrow( () => {

				this.run.revision = Revision.loadByRevisionId( 1 );

			} );

		} );

		it( 'revisionId', function () {

			// Getter
			const revisionId = this.run.revisionId;
			const gold = Revision.loadByRevisionId( 1 );

			assert.strictEqual( revisionId, gold.revisionId );

			// Setter
			assert.throws( () => {

				this.run.revisionId = - 1;

			}, { name: 'Error' } );

			assert.throws( () => {

				this.run.revisionId = 1;

			}, { name: 'Error' } );

		} );

		it( 'parentRun', function () {

			// Getter
			const parentRun = this.run.parentRun;
			assert.strictEqual( parentRun, null );

			const run2 = Run.loadByRunId( 2 );
			const gold = Run.loadByRunId( 1 );
			assert.deepEqual( run2.parentRun, gold );

			// Setter
			assert.throws( () => {

				this.run.parentRun = {};

			}, { name: 'Error' } );

			assert.doesNotThrow( () => {

				this.run.parentRun = null;

			} );

			assert.doesNotThrow( () => {

				this.run.parentRun = Run.loadByRevisionId( 1 );

			} );

		} );

		it( 'parentRunId', function () {

			// Getter
			assert.strictEqual( this.run.parentRunId, null );

			const run2 = Run.loadByRunId( 2 );
			assert.strictEqual( run2.parentRunId, 1 );


			// Setter
			assert.throws( () => {

				this.run.parentRunId = - 1;

			}, { name: 'Error' } );

			assert.throws( () => {

				this.run.parentRunId = 1;

			}, { name: 'Error' } );

		} );

		it( 'baselineRun', function () {

			// Getter
			const baselineRun = this.run.baselineRun;
			assert.strictEqual( baselineRun, null );

			const run2 = Run.loadByRunId( 2 );
			const gold = Run.loadByRunId( 1 );
			assert.deepEqual( run2.baselineRun, gold );

			// Setter
			assert.throws( () => {

				this.run.baselineRun = {};

			}, { name: 'Error' } );

			assert.doesNotThrow( () => {

				this.run.baselineRun = null;

			} );

			assert.doesNotThrow( () => {

				this.run.baselineRun = Run.loadByRevisionId( 1 );

			} );

		} );

		it( 'baselineRunId', function () {

			// Getter
			assert.strictEqual( this.run.baselineRunId, null );

			const run2 = Run.loadByRunId( 2 );
			assert.deepEqual( run2.baselineRunId, 1 );


			assert.throws( () => {

				this.run.baselineRunId = - 1;

			}, { name: 'Error' } );

			assert.throws( () => {

				this.run.baselineRunId = 1;

			}, { name: 'Error' } );

		} );

		it( 'overview', function () {

			// Getter
			const overview = this.run.overview;
			assert.strictEqual( overview, null );

			const run2 = Run.loadByRunId( 2 );
			const gold = Overview.loadById( 1 );
			assert.deepEqual( run2.overview, gold );

			// Setter
			assert.throws( () => {

				this.run.overview = {};

			}, { name: 'Error' } );

			assert.doesNotThrow( () => {

				this.run.overview = null;

			} );

			assert.doesNotThrow( () => {

				this.run.overview = Overview.loadById( 1 );

			} );

		} );

		it( 'overviewId', function () {

			// Getter
			assert.strictEqual( this.run.overviewId, null );

			const run2 = Run.loadByRunId( 2 );
			const gold = Overview.loadById( 1 );
			assert.deepEqual( run2.overviewId, gold.overviewId );

			// Setter
			assert.throws( () => {

				this.run.overviewId = - 1;

			}, { name: 'Error' } );

			assert.throws( () => {

				this.run.overviewId = 1;

			}, { name: 'Error' } );

		} );

	} );

	it( 'loadBy*', function () {

		const run1 = Run.loadByRevisionId( 1 );
		const run2 = Run.loadByRunId( 1 );

		assert.strictEqual( run1.baselineRun, null );
		assert.strictEqual( run1.parentRun, null );
		assert.strictEqual( run1.overview, null );

		assert.strictEqual( run1.revisionId, 1 );

		assert.deepStrictEqual( run1, run2 );

		assert.throws( () => Run.loadByRevisionId( - 1 ), { name: 'Error' } );
		assert.throws( () => Run.loadByRunId( - 1 ), { name: 'Error' } );

	} );

	it( 'getDependencies, missing base run', function () {

		const run = Run.loadByRunId( 4 );

		assert.throws( () => run.getDependencies(), { name: 'Error' } );

	} );

	it( 'getDependencies, base run', function () {

		const run = Run.loadByRunId( 1 );

		assert.doesNotThrow( () => run.getDependencies(), { name: 'Error' } );

		const gold = {
			'example1': [ 'source1', 'source2', 'source3', 'source4' ],
			'example2': [ 'source1', 'source2' ]
		};

		const deps = run.getDependencies();

		assert.deepStrictEqual( deps, gold );

	} );

	it( 'getDependencies, existing base run', function () {

		const run = Run.loadByRunId( 2 );

		const deps = run.getDependencies();

		const gold = {
			'example1': [ 'source1', 'source2', 'source3', 'source4' ],
			'example2': [ 'source3' ],
			'example3': [ 'source1' ]
		};

		assert.deepStrictEqual( deps, gold );

	} );

	it( 'saveDependencies, existing base run', function () {

		const run3 = Run.loadByRunId( 3 );

		const dependencies3 = {
			'example1': [ 'source4', 'source5' ],
			'example2': null
		};
		run3.saveDependencies( dependencies3 );

		const gold3 = {
			'example1': [ 'source4', 'source5' ]
		};

		const test3 = run3.getDependencies();

		assert.deepStrictEqual( test3, gold3 );

	} );

	it( 'saveDependencies, wrong format for forceAll=true', function () {

		const run3 = Run.loadByRunId( 3 );

		const dependencies = {
			'example1': [ 'source4', 'source5' ],
			'example2': null
		};

		assert.doesNotThrow( () => run3.saveDependencies( dependencies, true ) );

		const gold = {
			'example1': [ 'source4', 'source5' ]
		};

		const test = run3.getDependencies();

		assert.deepStrictEqual( test, gold );

	} );

	it( 'saveDependencies, no base run', function () {

		const run4 = Run.loadByRunId( 4 );

		const dependencies = {
			'example1': [ 'source4', 'source5' ],
			'example2': [ 'source1' ]
		};
		run4.saveDependencies( dependencies );

		const test = run4.getDependencies();

		assert.deepStrictEqual( test, dependencies );

	} );

	it( 'create a new run', function () {

		const rev = new Revision();
		rev.sha = '0000000000000000000000000000000000000005';
		assert.doesNotThrow( () => rev.save() );

		const run = new Run();

		run.revision = rev;
		run.delayAfterCommit = 0;
		run.dependenciesChanged = 'false';
		run.duration = 0;
		run.machineId = 1;
		run.majorErrors = 0;
		run.reason = 'CI';
		run.timestamp = 0;
		run.type = null;

		assert.doesNotThrow( () => run.save() );

		assert.strictEqual( run.runId, 5 );

		const test = Run.loadByRunId( 5 );

		assert.deepStrictEqual( test, run );

	} );

} );
