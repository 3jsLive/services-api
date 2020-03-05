/*
	count hits per file, e.g. test 'check for broken links' found 4 broken links in foo.html -> foo.html: 4
*/

module.exports = ( checks, checkResults, linters, linterResults, dependencies, dependenciesResults, profiling, profilingResults ) => {

	const files = {};

	const hitsCounterFn = ( testResults ) => Object.entries( testResults ).reduce( ( all, [ file, results ] ) => {

		all[ file ] = results.hits;

		return all;

	}, {} );

	const resultsCounterFn = ( testResults ) => Object.entries( testResults ).reduce( ( all, [ file, results ] ) => {

		all[ file ] = results.results.length;

		return all;

	}, {} );


	// checks
	files[ 'DocsExamples' ] = { files: hitsCounterFn( checkResults[ 'checkDocsForBrokenExampleLinks' ][ 'results' ] ) };
	files[ 'DocsExternals' ] = { files: hitsCounterFn( checkResults[ 'checkDocsForBrokenExternalLinks' ][ 'results' ] ) };
	files[ 'NonDocsExternals' ] = { files: hitsCounterFn( checkResults[ 'checkNonDocsForBrokenExternalLinks' ][ 'results' ] ) };
	files[ 'CompSrcExp' ] = { files: hitsCounterFn( checkResults[ 'compareSourceExports' ][ 'results' ] ) };
	files[ 'CompExmplsExp' ] = { files: hitsCounterFn( checkResults[ 'compareExamplesExports' ][ 'results' ] ) };
	files[ 'DocsDecl' ] = { files: hitsCounterFn( checkResults[ 'compareDeclarationsWithDocs' ][ 'results' ] ) };
	files[ 'ObjDecl' ] = { files: hitsCounterFn( checkResults[ 'compareDeclarationsWithInstancedObjects' ][ 'results' ] ) };
	files[ 'SrcDecl' ] = { files: hitsCounterFn( checkResults[ 'compareDeclarationsWithSource' ][ 'results' ] ) };

	// TODO:
	// files[ 'TSCompiler' ] = {
	// 	files: Object.assign( {},
	// 		countFn( checkResults[ 'TSCompiler' ][ 'js' ][ 'results' ] ),
	// 		countFn( checkResults[ 'TSCompiler' ][ 'dts' ][ 'results' ] )
	// 	)
	// };

	files[ 'UnitTests' ] = { files: { 'UNITTESTS': checkResults[ 'runUnitTests' ].failed } };


	// linters
	linters.forEach( name => {

		// FIXME: hax, somewhere this got mixed up and now look where we ended up
		const testName = name.replace( 'doobDoc', 'DoobsDoc' );

		files[ testName ] = { files: resultsCounterFn( linterResults[ name ][ 'results' ] ) };

	} );


	// dependencies
	dependencies.forEach( name => {

		files[ name ] = { files: resultsCounterFn( dependenciesResults[ name ][ 'results' ] ) };

	} );


	// profiling
	profiling.forEach( name => {

		files[ name ] = { files: resultsCounterFn( profilingResults[ name ][ 'results' ] ) };

	} );

	return files;

};
