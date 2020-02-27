const fs = require( 'fs' );
const sqlite = require( 'better-sqlite3' );

const t = require( 'tap' );

t.test( `helpers / Run`, t => {

	const testDatabase = new sqlite( `Run.tests.db`, { memory: true } );

	require( '../src/Database' )( testDatabase ); // rigging

	const Run = require( '../src/helpers/Run' );
	const Revision = require( '../src/helpers/Revision' );
	const Overview = require( '../src/helpers/Overview' );

	const dbSchema = fs.readFileSync( `${__dirname}/../src/schema.sql`, 'utf8' );
	const dbData = fs.readFileSync( `${__dirname}/helpers/Run/data.sql`, 'utf8' );

	t.beforeEach( ( done/* , t */ ) => {

		testDatabase.exec( `PRAGMA foreign_keys = '0';` );
		testDatabase.exec( dbSchema );
		testDatabase.exec( dbData );
		testDatabase.exec( `PRAGMA foreign_keys = '1';` );

		done();

	} );

	t.test( 'Setters/Getters', t => {

		t.beforeEach( ( done/* , t */ ) => {

			this.run = Run.loadByRunId( 1 );

			done();

		} );

		t.test( 'revision', t => {

			// Getter
			const revision = this.run.revision;
			const gold = Revision.loadByRevisionId( 1 );

			t.same( revision, gold );

			// Setter
			t.throws( () => {

				this.run.revision = {};

			}, { name: 'Error' } );

			t.doesNotThrow( () => {

				this.run.revision = null;

			} );

			t.doesNotThrow( () => {

				this.run.revision = Revision.loadByRevisionId( 1 );

			} );

			t.end();

		} );

		t.test( 'revisionId', t => {

			// Getter
			const revisionId = this.run.revisionId;
			const gold = Revision.loadByRevisionId( 1 );

			t.strictSame( revisionId, gold.revisionId );

			// Setter
			t.throws( () => {

				this.run.revisionId = - 1;

			}, { name: 'Error' } );

			t.throws( () => {

				this.run.revisionId = 1;

			}, { name: 'Error' } );

			t.end();

		} );

		t.test( 'parentRun', t => {

			// Getter
			const parentRun = this.run.parentRun;
			t.strictSame( parentRun, null );

			const run2 = Run.loadByRunId( 2 );
			const gold = Run.loadByRunId( 1 );
			t.same( run2.parentRun, gold );

			// Setter
			t.throws( () => {

				this.run.parentRun = {};

			}, { name: 'Error' } );

			t.doesNotThrow( () => {

				this.run.parentRun = null;

			} );

			t.doesNotThrow( () => {

				this.run.parentRun = Run.loadByRevisionId( 1 );

			} );

			t.end();

		} );

		t.test( 'parentRunId', t => {

			// Getter
			t.same( this.run.parentRunId, null );

			const run2 = Run.loadByRunId( 2 );
			t.strictSame( run2.parentRunId, 1 );


			// Setter
			t.throws( () => {

				this.run.parentRunId = - 1;

			}, { name: 'Error' } );

			t.throws( () => {

				this.run.parentRunId = 1;

			}, { name: 'Error' } );

			t.end();

		} );

		t.test( 'baselineRun', t => {

			// Getter
			const baselineRun = this.run.baselineRun;
			t.strictEqual( baselineRun, null );

			const run2 = Run.loadByRunId( 2 );
			const gold = Run.loadByRunId( 1 );
			t.deepEqual( run2.baselineRun, gold );

			// Setter
			t.throws( () => {

				this.run.baselineRun = {};

			}, { name: 'Error' } );

			t.doesNotThrow( () => {

				this.run.baselineRun = null;

			} );

			t.doesNotThrow( () => {

				this.run.baselineRun = Run.loadByRevisionId( 1 );

			} );

			t.end();

		} );

		t.test( 'baselineRunId', t => {

			// Getter
			t.strictEqual( this.run.baselineRunId, null );

			const run2 = Run.loadByRunId( 2 );
			t.deepEqual( run2.baselineRunId, 1 );


			t.throws( () => {

				this.run.baselineRunId = - 1;

			}, { name: 'Error' } );

			t.throws( () => {

				this.run.baselineRunId = 1;

			}, { name: 'Error' } );

			t.end();

		} );

		t.test( 'overview', t => {

			// Getter
			const overview = this.run.overview;
			t.strictEqual( overview, null );

			const run2 = Run.loadByRunId( 2 );
			const gold = Overview.loadById( 1 );
			t.deepEqual( run2.overview, gold );

			// Setter
			t.throws( () => {

				this.run.overview = {};

			}, { name: 'Error' } );

			t.doesNotThrow( () => {

				this.run.overview = null;

			} );

			t.doesNotThrow( () => {

				this.run.overview = Overview.loadById( 1 );

			} );

			t.end();

		} );

		t.test( 'overviewId', t => {

			// Getter
			t.strictEqual( this.run.overviewId, null );

			const run2 = Run.loadByRunId( 2 );
			const gold = Overview.loadById( 1 );
			t.deepEqual( run2.overviewId, gold.overviewId );

			// Setter
			t.throws( () => {

				this.run.overviewId = - 1;

			}, { name: 'Error' } );

			t.throws( () => {

				this.run.overviewId = 1;

			}, { name: 'Error' } );

			t.end();

		} );

		t.test( 'lazy loads', t => {

			const run = new Run();

			run._baselineRun = 2;

			t.strictEqual( run._baselineRun, 2 );

			const oldRun = Run.loadByRunId( 2 );

			t.strictSame( run.baselineRun, oldRun );

			t.strictEqual( run.baselineRun._baselineRun, 1 );

			t.end();

		} );

		t.end();

	} );

	t.test( 'loadBy*', t => {

		const run1 = Run.loadByRevisionId( 1 );
		const run2 = Run.loadByRunId( 1 );

		t.strictEqual( run1.baselineRun, null );
		t.strictEqual( run1.parentRun, null );
		t.strictEqual( run1.overview, null );

		t.strictEqual( run1.revisionId, 1 );

		t.strictSame( run1, run2 );

		t.throws( () => Run.loadByRevisionId( - 1 ), { name: 'Error' } );
		t.throws( () => Run.loadByRunId( - 1 ), { name: 'Error' } );

		t.end();

	} );

	t.test( 'getDependencies, missing base run', t => {

		const run = Run.loadByRunId( 4 );

		t.throws( () => run.getDependencies(), { name: 'Error' } );

		t.end();

	} );

	t.test( 'getDependencies, base run', t => {

		const run = Run.loadByRunId( 1 );

		t.doesNotThrow( () => run.getDependencies(), { name: 'Error' } );

		const gold = {
			'example1': [ 'source1', 'source2', 'source3', 'source4' ],
			'example2': [ 'source1', 'source2' ]
		};

		const deps = run.getDependencies();

		t.strictSame( deps, gold );

		t.end();

	} );

	t.test( 'getDependencies, existing base run', t => {

		const run = Run.loadByRunId( 2 );

		const deps = run.getDependencies();

		const gold = {
			'example1': [ 'source1', 'source2', 'source3', 'source4' ],
			'example2': [ 'source1', 'source2', 'source3' ],
			'example3': [ 'source1' ]
		};

		t.strictSame( deps, gold );

		t.end();

	} );

	// t.test( 'getDependencies, various', t => {

	// 	const revision = Revision.loadBySHA( 'd3bb31794a4725dcb437f9b3a2f9e8857c834c4c' );
	// 	const run = Run.loadByRevisionId( revision.revisionId );


	// 	t.end();
	// });

	t.test( 'saveDependencies, existing base run, one deleted dependency', t => {

		const run3 = Run.loadByRunId( 3 );

		const dependencies3 = {
			'example2': null
		};
		run3.saveDependencies( dependencies3 );

		const gold3 = {
			'example1': [ 'source1', 'source2', 'source3', 'source4' ]
		};

		const test3 = run3.getDependencies();

		t.strictSame( test3, gold3 );

		t.end();

	} );

	t.test( 'saveDependencies, existing base run, one changed and one deleted dependency', t => {

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

		t.strictSame( test3, gold3 );

		t.end();

	} );

	t.test( 'saveDependencies, existing base run, one changed and one identical dependency', t => {

		const run3 = Run.loadByRunId( 3 );

		const dependencies3 = {
			'example1': [ 'source4', 'source5' ],
			'example2': [ 'source1', 'source2' ]
		};
		run3.saveDependencies( dependencies3 );

		const gold3 = {
			'example1': [ 'source4', 'source5' ],
			'example2': [ 'source1', 'source2' ]
		};

		const test3 = run3.getDependencies();

		t.strictSame( test3, gold3 );

		t.end();

	} );

	t.test( 'saveDependencies, existing base run, one completely new dependency', t => {

		const run3 = Run.loadByRunId( 3 );

		const dependencies3 = {
			'example3': [ 'source4', 'source5' ]
		};
		run3.saveDependencies( dependencies3 );

		const gold3 = {
			'example1': [ 'source1', 'source2', 'source3', 'source4' ],
			'example2': [ 'source1', 'source2' ],
			'example3': [ 'source4', 'source5' ]
		};

		const test3 = run3.getDependencies();

		t.strictSame( test3, gold3 );

		t.end();

	} );

	t.test( 'saveDependencies, wrong format for forceAll=true', t => {

		const run3 = Run.loadByRunId( 3 );

		const dependencies = {
			'example1': [ 'source4', 'source5' ],
			'example2': null
		};

		t.doesNotThrow( () => run3.saveDependencies( dependencies, true ) );

		const gold = {
			'example1': [ 'source4', 'source5' ]
		};

		const test = run3.getDependencies();

		t.strictSame( test, gold );

		t.end();

	} );

	t.test( 'saveDependencies, no base run', t => {

		const run4 = Run.loadByRunId( 4 );

		const dependencies = {
			'example1': [ 'source4', 'source5' ],
			'example2': [ 'source1' ]
		};

		run4.saveDependencies( dependencies, true );

		const test = run4.getDependencies();

		t.strictSame( test, dependencies );

		t.end();

	} );

	t.test( 'create a new run', t => {

		const rev = new Revision();
		rev.sha = '0000000000000000000000000000000000000005';
		t.doesNotThrow( () => rev.save() );

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

		t.doesNotThrow( () => run.save() );

		t.strictEqual( run.runId, 5 );

		const test = Run.loadByRunId( 5 );

		t.strictSame( test, run );

		t.end();

	} );

	t.test( 'cleanResults*', t => {

		t.todo( 'Add once Results helper is up' );

		t.end();

	} );

	t.test( 'cleanErrors*', t => {

		t.todo( 'Add once Errors helper is up' );

		t.end();

	} );

	t.end();

} );
