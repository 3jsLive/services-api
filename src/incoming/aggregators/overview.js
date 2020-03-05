/*
	the overview is the big table on a run's main page
	listing the current run's results in comparison to
	the parent as well as the current run's baseline.
*/

module.exports = ( checks, checkResults, linters, linterResults, dependencies, dependenciesResults, profiling, profilingResults ) => {

	const overview = {};

	const hitCounterFn = ( testResults ) => Object.values( testResults ).reduce( ( all, results ) => all += results.hits, 0 );
	const resultsCounterFn = ( testResults ) => Object.values( testResults ).reduce( ( all, { results: r } ) => all += r.length, 0 );

	// checks
	overview[ 'DocsExamples' ] = { result: hitCounterFn( checkResults[ 'checkDocsForBrokenExampleLinks' ][ 'results' ] ) };
	overview[ 'DocsExternals' ] = { result: hitCounterFn( checkResults[ 'checkDocsForBrokenExternalLinks' ][ 'results' ] ) };
	overview[ 'NonDocsExternals' ] = { result: hitCounterFn( checkResults[ 'checkNonDocsForBrokenExternalLinks' ][ 'results' ] ) };
	overview[ 'CompSrcExp' ] = { result: hitCounterFn( checkResults[ 'compareSourceExports' ][ 'results' ] ) };
	overview[ 'CompExmplsExp' ] = { result: hitCounterFn( checkResults[ 'compareExamplesExports' ][ 'results' ] ) };
	overview[ 'DocsDecl' ] = { result: hitCounterFn( checkResults[ 'compareDeclarationsWithDocs' ][ 'results' ] ) };
	overview[ 'ObjDecl' ] = { result: hitCounterFn( checkResults[ 'compareDeclarationsWithInstancedObjects' ][ 'results' ] ) };
	overview[ 'SrcDecl' ] = { result: hitCounterFn( checkResults[ 'compareDeclarationsWithSource' ][ 'results' ] ) };

	overview[ 'UnitTests' ] = { result: checkResults[ 'runUnitTests' ].failed };

	// TODO:
	// overview[ 'TSCompiler' ] = { result:
	// countFn( checkResults[ 'checkWithTSCompiler' ][ 'js' ][ 'results' ] ) + countFn( checkResults[ 'checkWithTSCompiler' ][ 'dts' ][ 'results' ] )
	// };


	// linters
	linters.forEach( name => {

		// FIXME: hax, somewhere this got mixed up and now look where we ended up
		const testName = name.replace( 'doobDoc', 'DoobsDoc' );

		overview[ testName ] = { result: resultsCounterFn( linterResults[ name ][ 'results' ] ) };

	} );


	// dependencies
	dependencies.forEach( name => {

		overview[ name ] = { result: resultsCounterFn( dependenciesResults[ name ][ 'results' ] ) };

	} );


	// dependencies
	profiling.forEach( name => {

		overview[ name ] = { result: resultsCounterFn( profilingResults[ name ][ 'results' ] ) };

	} );

	return overview;

};
