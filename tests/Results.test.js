const fs = require( 'fs' );
const sqlite = require( 'better-sqlite3' );

const t = require( 'tap' );

t.test( `helpers / Results`, t => {

	const testDatabase = new sqlite( `Results.tests.db`, { memory: true } );

	const DB = require( '../src/Database' );
	DB.db = testDatabase; // rigging

	const Results = require( '../src/helpers/Results' );

	const dbSchema = fs.readFileSync( `${__dirname}/../src/schema.sql`, 'utf8' );
	const dbData = fs.readFileSync( `${__dirname}/helpers/Results/data.sql`, 'utf8' );

	t.beforeEach( ( done/* , t */ ) => {

		testDatabase.exec( `PRAGMA foreign_keys = '0';` );
		testDatabase.exec( dbSchema );
		testDatabase.exec( dbData );
		testDatabase.exec( `PRAGMA foreign_keys = '1';` );

		done();

	} );


	t.test( 'loadByRunId', t => {

		t.test( 'base run', t => {

			const results = Results.loadByRunId( 1 );

			const gold = JSON.parse( fs.readFileSync( `${__dirname}/helpers/Results/gold-run1.json`, 'utf8' ) );

			t.strictDeepEqual( results, gold );

			t.end();

		} );

		t.test( 'child, unmerged', t => {

			const results = Results.loadByRunId( 2 );

			const gold = JSON.parse( fs.readFileSync( `${__dirname}/helpers/Results/gold-run2.json`, 'utf8' ) );

			t.strictDeepEqual( results, gold );

			t.end();

		} );

		t.test( 'child, merged', t => {

			const results = Results.loadByRunId( 2, 1 );

			const gold = JSON.parse( fs.readFileSync( `${__dirname}/helpers/Results/gold-run2-merged.json`, 'utf8' ) );

			t.strictDeepEqual( results, gold );

			t.end();

		} );

		t.test( 'missing run', t => {

			t.throws( () => Results.loadByRunId( 4 ), Error );

			t.end();

		} );

		t.end();

	} );

	const combos = [
		[ 1, 0 ],
		[ 2, 0 ],
		[ 2, 1 ],
	];

	t.test( 'reformatToFileBased', t => {

		for ( const [ runId, baseRunId ] of combos ) {

			let gold;

			if ( baseRunId > 0 )
				gold = JSON.parse( fs.readFileSync( `${__dirname}/helpers/Results/gold-run${runId}-fileBased-merged.json`, 'utf8' ) );
			else
				gold = JSON.parse( fs.readFileSync( `${__dirname}/helpers/Results/gold-run${runId}-fileBased.json`, 'utf8' ) );

			const results = Results.loadByRunId( runId, baseRunId );

			const formatted = Results.reformatToFileBased( results );

			t.strictDeepEqual( formatted, gold, `runId: ${runId}, baseRunId: ${baseRunId}, merged: ${baseRunId > 0}` );

		}

		t.end();

	} );

	t.test( 'reformatToTestBased', t => {

		for ( const [ runId, baseRunId ] of combos ) {

			let gold;

			if ( baseRunId > 0 )
				gold = JSON.parse( fs.readFileSync( `${__dirname}/helpers/Results/gold-run${runId}-testBased-merged.json`, 'utf8' ) );
			else
				gold = JSON.parse( fs.readFileSync( `${__dirname}/helpers/Results/gold-run${runId}-testBased.json`, 'utf8' ) );

			const results = Results.loadByRunId( runId, baseRunId );

			const formatted = Results.reformatToTestBased( results );

			t.strictDeepEqual( formatted, gold, `runId: ${runId}, baseRunId: ${baseRunId}, merged: ${baseRunId > 0}` );

		}

		t.end();

	} );

	t.test( 'saveResult', t => {

		t.test( 'save new', t => {

			Results.saveResult( 3, 1, 1, 111 );

			const results = Results.loadByRunId( 3 );

			const gold = JSON.parse( fs.readFileSync( `${__dirname}/helpers/Results/gold-saveResult-new.json`, 'utf8' ) );

			t.strictDeepEqual( results, gold );

			t.end();

		} );

		t.test( 'save new with base', t => {

			Results.saveResult( 3, 1, 3, 123, 2 );
			Results.saveResult( 3, 1, 4, 1234, 2 );

			const results = Results.loadByRunId( 3, 1 );

			const gold = JSON.parse( fs.readFileSync( `${__dirname}/helpers/Results/gold-saveResult-newWithBase.json`, 'utf8' ) );

			t.strictDeepEqual( results, gold );

			t.end();

		} );

		t.test( 'update existing', t => {

			t.todo( 'Should we actually support this? Kinda breaks the whole runs-are-immutable plan.' );

			// Results.saveResult( 1, 1, 3, 333 );

			// const results = Results.loadByRunId( 1 );

			// const gold = JSON.parse( fs.readFileSync( `${__dirname}/helpers/Results/gold-saveResult-updateExisting.json`, 'utf8' ) );

			// t.strictDeepEqual( results, gold );

			t.end();

		} );

		t.end();

	} );

	/* t.test( 'reformatToDependencyBased', t => {

		for ( const [ revId, baseRevId ] of combos ) {

			let gold;

			if ( baseRevId > 0 )
				gold = JSON.parse( fs.readFileSync( `${__dirname}/helpers/Dependencies/gold-deps${revId}-dependencyBased-merged.json`, 'utf8' ) );
			else
				gold = JSON.parse( fs.readFileSync( `${__dirname}/helpers/Dependencies/gold-deps${revId}-dependencyBased.json`, 'utf8' ) );

			const deps = Dependencies.loadByRevisionId( revId, baseRevId );

			const formatted = Dependencies.reformatToDependencyBased( deps );

			t.strictDeepEqual( formatted, gold, `revId: ${revId}, baseRevId: ${baseRevId}, merged: ${baseRevId > 0}` );

		}

		t.end();

	} );

	t.test( 'parseGitDiff', t => {

		const outputs = [
			'MAD',
			'MAD-2',
			'MMR',
			'unknown'
		];

		for ( const out of outputs ) {

			const raw = fs.readFileSync( `${__dirname}/helpers/Dependencies/git-${out}.txt`, 'utf8' );

			const gold = JSON.parse( fs.readFileSync( `${__dirname}/helpers/Dependencies/gold-git-${out}.json`, 'utf8' ) );

			const parsed = Dependencies.parseGitDiff( raw );

			t.strictDeepEqual( parsed, gold, out );

		}

		t.end();

	} );

	t.test( 'compareWithGitDiff', t => {

		t.test( 'examples', t => {

			const retval = shell.exec(
				`git diff --name-status 8604213c9dd95ed42931b755bffce838f917ccb0 8e9cd31b6ec0303b30fd851d9dee5d178b3fca72`,
				{ encoding: 'utf8', silent: true, cwd: `${config.root}/${config.threejsRepository}/.git` }
			);

			const data = fs.readFileSync( `${__dirname}/helpers/Dependencies/real-test.sql`, 'utf8' );

			testDatabase.exec( `PRAGMA foreign_keys = '0';` );
			testDatabase.exec( dbSchema );
			testDatabase.exec( data );
			testDatabase.exec( `PRAGMA foreign_keys = '1';` );

			const actions = Dependencies.parseGitDiff( retval.stdout );

			const dependencies = Dependencies.reformatToDependencyBased( Dependencies.loadByRevisionId( 1 ) );

			const result = Dependencies.compareWithGitDiff( dependencies, actions );

			t.deepEqual( result, [ 'examples/webgl_shadowmap_csm.html' ] );

			t.end();

		} );


		t.test( 'deleted', t => {

			const retval = shell.exec(
				`git diff --name-status e0e541ba1ff246a84c3e947991dc54fad21dbe0d b80a91ac358981998642388212e6a76e97d9eaf5`,
				{ encoding: 'utf8', silent: true, cwd: `${config.root}/${config.threejsRepository}/.git` }
			);

			const data = fs.readFileSync( `${__dirname}/helpers/Dependencies/real-test-2.sql`, 'utf8' );

			testDatabase.exec( dbSchema );
			testDatabase.exec( `PRAGMA foreign_keys = '0';` );
			testDatabase.exec( data );

			const actions = Dependencies.parseGitDiff( retval.stdout );

			const rev = Revision.loadBySHA( 'e0e541ba1ff246a84c3e947991dc54fad21dbe0d' );
			const run = Run.loadByRevisionId( rev.revisionId );
			const baseRevId = ( run.baselineRunId ) ? run.baselineRunId : - 1;
			const deps = Dependencies.loadByRevisionId( rev.revisionId, baseRevId );

			const formatted = Dependencies.reformatToDependencyBased( deps );
			const result = Dependencies.compareWithGitDiff( formatted, actions );

			t.deepEqual( result, [ 'examples/webgl_materials_physical_clearcoat.html' ] );

			t.end();

		} );

		t.test( 'added', t => {

			const retval = shell.exec(
				`git diff --name-status e11983171f2eaa26bbf2cca8482765db92691988 a3ca9ba6ea729bfaaf7213cac4fbff1273934a8d`,
				{ encoding: 'utf8', silent: true, cwd: `${config.root}/${config.threejsRepository}/.git` }
			);

			// const data = fs.readFileSync( `${__dirname}/helpers/Dependencies/real-test-2.sql`, 'utf8' );

			// testDatabase.exec( dbSchema );
			// testDatabase.exec( `PRAGMA foreign_keys = '0';` );
			// testDatabase.exec( data );

			Dependencies.parseGitDiff( retval.stdout );

			t.todo( 'needs deps run first' );

			t.end();

		} );

		t.end();

	} );

	t.test( 'saveDependencies, no delta', t => {

		const dependencies = {
			'stays-the-same': [ 'script1', 'script2', 'script3' ],
			'delete-one': [ 'script1', 'script4' ],
			'add-one': [ 'script1' ],
			'change-one': [ 'script1', 'script2' ],
			'delete-me': [ 'script3', 'script4' ],
			'background-murmur': [ 'script1', 'script2' ],
			'random-null': null
		};

		Dependencies.saveDependencies( 10, dependencies );

		const result = Dependencies.loadByRevisionId( 10 );
		const formatted = Dependencies.reformatToSourceBased( result );

		delete dependencies[ 'random-null' ];

		t.strictDeepEqual( formatted, dependencies );

		t.end();

	} );

	t.test( 'saveDependencies, delta', t => {

		const baseDependencies = {
			'stays-the-same': [ 'script1', 'script2', 'script3' ],
			'delete-one': [ 'script1', 'script4' ],
			'add-one': [ 'script1' ],
			'change-one': [ 'script1', 'script2' ],
			'delete-me': [ 'script3', 'script4' ],
			'background-murmur': [ 'script1', 'script2' ]
		};

		const childDependencies = {
			'stays-the-same': [ 'script1', 'script2', 'script3' ],
			'delete-one': [ 'script4' ],
			'add-one': [ 'script1', 'script5' ],
			'change-one': [ 'script1', 'script3' ],
			'delete-me': null,
			'new-one': [ 'script5' ]
		};

		const gold = {
			'stays-the-same': [ 'script1', 'script2', 'script3' ],
			'background-murmur': [ 'script1', 'script2' ],
			'delete-one': [ 'script4' ],
			'add-one': [ 'script1', 'script5' ],
			'change-one': [ 'script1', 'script3' ],
			'new-one': [ 'script5' ]
		};

		Dependencies.saveDependencies( 10, baseDependencies );
		Dependencies.saveDependencies( 20, childDependencies, baseDependencies );

		const result = Dependencies.loadByRevisionId( 20, 10 );
		const formatted = Dependencies.reformatToSourceBased( result );

		t.strictDeepEqual( formatted, gold );

		t.end();

	} );

	t.test( '_createDelta', t => {

		const baseDependencies = {
			'stays-the-same': [ 'script1', 'script2', 'script3' ],
			'delete-one': [ 'script1', 'script4' ],
			'add-one': [ 'script1' ],
			'change-one': [ 'script1', 'script2' ],
			'delete-me': [ 'script3', 'script4' ],
			'background-murmur': [ 'script1', 'script2' ]
		};

		const childDependencies = {
			'stays-the-same': [ 'script1', 'script2', 'script3' ],
			'delete-one': [ 'script4' ],
			'add-one': [ 'script1', 'script5' ],
			'change-one': [ 'script1', 'script3' ],
			'delete-me': null,
			'new-one': [ 'script5' ]
		};

		const gold = [
			{ source: 'delete-one', dependency: 'script1', value: null },
			{ source: 'change-one', dependency: 'script2', value: null },
			{ source: 'delete-me', dependency: 'script3', value: null },
			{ source: 'delete-me', dependency: 'script4', value: null },
			{ source: 'add-one', dependency: 'script5', value: 1 },
			{ source: 'change-one', dependency: 'script3', value: 1 },
			{ source: 'new-one', dependency: 'script5', value: 1 }
		];

		const result = Dependencies._createDelta( childDependencies, baseDependencies );

		t.deepEqual( result, gold );

		t.end();

	} );


	// TODO:
	t.test( 'parseGitDiff vs. Step 12', t => {

		t.todo( 'a test that compares $x-many diffs of Dependencies.parseGitDiff().all with "Step 12" from incoming.js' );

		t.end();

	} ); */

	t.end();

} );
