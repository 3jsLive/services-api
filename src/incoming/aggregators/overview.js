/*
	the overview is the big table on a run's main page
	listing the current run's results in comparison to
	the parent as well as the current run's baseline.
*/

module.exports = ( checks, checkResults, linters, linterResults, dependencies, dependenciesResults ) => {

	const overview = {};

	const countFn = ( testResults ) => Object.values( testResults ).reduce( ( all, { results: r } ) => all += r.length, 0 );

	// checks
	overview[ 'DocsExamples' ] = { result: countFn( checkResults[ 'checkDocsForBrokenExampleLinks' ][ 'results' ] ) };
	overview[ 'DocsExternals' ] = { result: countFn( checkResults[ 'checkDocsForBrokenExternalLinks' ][ 'results' ] ) };
	overview[ 'NonDocsExternals' ] = { result: countFn( checkResults[ 'checkNonDocsForBrokenExternalLinks' ][ 'results' ] ) };
	overview[ 'CompSrcExp' ] = { result: countFn( checkResults[ 'compareSourceExports' ][ 'results' ] ) };
	overview[ 'CompExmplsExp' ] = { result: countFn( checkResults[ 'compareExamplesExports' ][ 'results' ] ) };

	// TODO:
	// overview[ 'UnitTests' ] = { result: checkResults[ 'UnitTests' ].failed };

	// TODO:
	// overview[ 'TSCompiler' ] = { result:
	// countFn( checkResults[ 'checkWithTSCompiler' ][ 'js' ][ 'results' ] ) + countFn( checkResults[ 'checkWithTSCompiler' ][ 'dts' ][ 'results' ] )
	// };

	// somewhat nested checks
	overview[ 'DocsDecl' ] = {
		result: Object.keys( checkResults[ 'compareDeclarationsWithDocs' ][ 'results' ] ).reduce( ( all, file ) => {

			if ( checkResults[ 'compareDeclarationsWithDocs' ][ 'results' ][ file ][ 'results' ].length === 0 )
				return all;

			all +=
		checkResults[ 'compareDeclarationsWithDocs' ][ 'results' ][ file ][ 'results' ][ 0 ].diff.methods.length + checkResults[ 'compareDeclarationsWithDocs' ][ 'results' ][ file ][ 'results' ][ 0 ].diff.properties.length +
		checkResults[ 'compareDeclarationsWithDocs' ][ 'results' ][ file ][ 'results' ][ 0 ].onlyDecl.methods.length + checkResults[ 'compareDeclarationsWithDocs' ][ 'results' ][ file ][ 'results' ][ 0 ].onlyDecl.properties.length +
		checkResults[ 'compareDeclarationsWithDocs' ][ 'results' ][ file ][ 'results' ][ 0 ].onlyDocs.methods.length + checkResults[ 'compareDeclarationsWithDocs' ][ 'results' ][ file ][ 'results' ][ 0 ].onlyDocs.properties.length;

			return all;

		}, 0 )

	};

	overview[ 'ObjDecl' ] = {
		result: Object.keys( checkResults[ 'compareDeclarationsWithInstancedObjects' ][ 'results' ] ).reduce( ( all, file ) =>
			all += Object.keys( checkResults[ 'compareDeclarationsWithInstancedObjects' ][ 'results' ][ file ][ 'results' ] ).reduce( ( total, klass ) =>
				total += checkResults[ 'compareDeclarationsWithInstancedObjects' ][ 'results' ][ file ][ 'results' ][ klass ].onlyDecl.methods.length + checkResults[ 'compareDeclarationsWithInstancedObjects' ][ 'results' ][ file ][ 'results' ][ klass ].onlyDecl.properties.length +
				checkResults[ 'compareDeclarationsWithInstancedObjects' ][ 'results' ][ file ][ 'results' ][ klass ].onlySource.methods.length + checkResults[ 'compareDeclarationsWithInstancedObjects' ][ 'results' ][ file ][ 'results' ][ klass ].onlySource.properties.length
			, 0 )
		, 0 )
	};

	overview[ 'SrcDecl' ] = {
		result: Object.keys( checkResults[ 'compareDeclarationsWithSource' ][ 'results' ] ).reduce( ( all, file ) => {

			if ( checkResults[ 'compareDeclarationsWithSource' ][ 'results' ][ file ][ 'results' ].length === 0 )
				return all;

			all +=
			checkResults[ 'compareDeclarationsWithSource' ][ 'results' ][ file ][ 'results' ][ 0 ].onlyDecl.methods.length + checkResults[ 'compareDeclarationsWithSource' ][ 'results' ][ file ][ 'results' ][ 0 ].onlyDecl.properties.length +
			checkResults[ 'compareDeclarationsWithSource' ][ 'results' ][ file ][ 'results' ][ 0 ].onlySource.methods.length + checkResults[ 'compareDeclarationsWithSource' ][ 'results' ][ file ][ 'results' ][ 0 ].onlySource.properties.length;

			return all;

		}, 0 )
	};


	// linters
	linters.forEach( name => {

		// FIXME: hax, somewhere this got mixed up and now look where we ended up
		const testName = name.replace( 'doobDoc', 'DoobsDoc' );

		overview[ testName ] = { result: countFn( linterResults[ name ][ 'results' ] ) };

	} );


	// dependencies
	dependencies.forEach( name => {

		overview[ name ] = { result: countFn( dependenciesResults[ name ][ 'results' ] ) };

	} );

	return overview;

};
