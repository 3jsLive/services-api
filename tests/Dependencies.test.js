const fs = require( 'fs' );
const sqlite = require( 'better-sqlite3' );
const config = require( 'rc' )( '3cidev' );

const t = require( 'tap' );

t.test( `helpers / Dependencies`, t => {

	const testDatabase = new sqlite( `Dependencies.tests.db`, { memory: true } );

	const Database = require( '../src/Database' ); // rigging
	Database._db = testDatabase;

	const shell = require( 'shelljs' );

	const Dependencies = require( '../src/helpers/Dependencies' );
	const Revision = require( '../src/helpers/Revision' );
	const Run = require( '../src/helpers/Run' );

	const dbSchema = fs.readFileSync( `${__dirname}/../src/schema.sql`, 'utf8' );
	const dbData = fs.readFileSync( `${__dirname}/helpers/Dependencies/data.sql`, 'utf8' );

	t.beforeEach( ( done/* , t */ ) => {

		testDatabase.exec( `PRAGMA foreign_keys = '0';` );
		testDatabase.exec( dbSchema );
		testDatabase.exec( dbData );
		testDatabase.exec( `PRAGMA foreign_keys = '1';` );

		done();

	} );


	t.test( 'loadByRevisionId', t => {

		t.test( 'base run', t => {

			const deps = Dependencies.loadByRevisionId( 1 );

			const gold = JSON.parse( fs.readFileSync( `${__dirname}/helpers/Dependencies/gold-deps1.json`, 'utf8' ) );

			t.strictDeepEqual( deps, gold );

			t.end();

		} );

		t.test( 'first child, unmerged', t => {

			const deps = Dependencies.loadByRevisionId( 2 );

			const gold = JSON.parse( fs.readFileSync( `${__dirname}/helpers/Dependencies/gold-deps2.json`, 'utf8' ) );

			t.strictDeepEqual( deps, gold );

			t.end();

		} );

		t.test( 'second child, unmerged', t => {

			const deps = Dependencies.loadByRevisionId( 3 );

			const gold = JSON.parse( fs.readFileSync( `${__dirname}/helpers/Dependencies/gold-deps3.json`, 'utf8' ) );

			t.strictDeepEqual( deps, gold );

			t.end();

		} );

		t.test( 'first child, merged', t => {

			const deps = Dependencies.loadByRevisionId( 2, 1 );

			const gold = JSON.parse( fs.readFileSync( `${__dirname}/helpers/Dependencies/gold-deps2-merged.json`, 'utf8' ) );

			t.strictDeepEqual( deps, gold );

			t.end();

		} );

		t.test( 'second child, merged', t => {

			const deps = Dependencies.loadByRevisionId( 3, 1 );

			const gold = JSON.parse( fs.readFileSync( `${__dirname}/helpers/Dependencies/gold-deps3-merged.json`, 'utf8' ) );

			t.strictDeepEqual( deps, gold );

			t.end();

		} );

		t.test( 'missing run', t => {

			t.throws( () => Dependencies.loadByRevisionId( 4 ), Error );

			t.end();

		} );

		t.end();

	} );

	const combos = [
		[ 1, 0 ],
		[ 2, 0 ],
		[ 3, 0 ],
		[ 2, 1 ],
		[ 3, 1 ]
	];

	t.test( 'reformatToSourceBased', t => {

		for ( const [ revId, baseRevId ] of combos ) {

			let gold;

			if ( baseRevId > 0 )
				gold = JSON.parse( fs.readFileSync( `${__dirname}/helpers/Dependencies/gold-deps${revId}-sourceBased-merged.json`, 'utf8' ) );
			else
				gold = JSON.parse( fs.readFileSync( `${__dirname}/helpers/Dependencies/gold-deps${revId}-sourceBased.json`, 'utf8' ) );

			const deps = Dependencies.loadByRevisionId( revId, baseRevId );

			const formatted = Dependencies.reformatToSourceBased( deps );

			t.strictDeepEqual( formatted, gold, `revId: ${revId}, baseRevId: ${baseRevId}, merged: ${baseRevId > 0}` );

		}

		t.end();

	} );

	t.test( 'reformatToDependencyBased', t => {

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

			/* const actions = */ Dependencies.parseGitDiff( retval.stdout );

			t.todo( 'needs deps run first' );

			t.end();

		} );

		t.end();

	} );

	t.end();

} );
