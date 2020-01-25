/*
	count hits per file, e.g. test 'check for broken links' found 4 broken links in foo.html -> foo.html: 4
*/

module.exports = ( checks, checkResults, linters, linterResults, dependencies, dependenciesResults ) => {

	const files = {};

	const countFn = ( testResults ) => Object.entries( testResults ).reduce( ( all, [ file, results ] ) => {

		all[ file ] = results.results.length;

		return all;

	}, {} );


	// checks
	files[ 'DocsExamples' ] = { files: countFn( checkResults[ 'checkDocsForBrokenExampleLinks' ][ 'results' ] ) };
	files[ 'DocsExternals' ] = { files: countFn( checkResults[ 'checkDocsForBrokenExternalLinks' ][ 'results' ] ) };
	files[ 'NonDocsExternals' ] = { files: countFn( checkResults[ 'checkNonDocsForBrokenExternalLinks' ][ 'results' ] ) };
	files[ 'CompSrcExp' ] = { files: countFn( checkResults[ 'compareSourceExports' ][ 'results' ] ) };
	files[ 'CompExmplsExp' ] = { files: countFn( checkResults[ 'compareExamplesExports' ][ 'results' ] ) };

	// TODO:
	// files[ 'TSCompiler' ] = {
	// 	files: Object.assign( {},
	// 		countFn( checkResults[ 'TSCompiler' ][ 'js' ][ 'results' ] ),
	// 		countFn( checkResults[ 'TSCompiler' ][ 'dts' ][ 'results' ] )
	// 	)
	// };

	files[ 'DocsDecl' ] = {
		files: Object.keys( checkResults[ 'compareDeclarationsWithDocs' ][ 'results' ] ).reduce( ( all, file ) => {

			if ( checkResults[ 'compareDeclarationsWithDocs' ][ 'results' ][ file ][ 'results' ].length === 0 )
				return all;

			const entry = checkResults[ 'compareDeclarationsWithDocs' ][ 'results' ][ file ][ 'results' ][ 0 ];

			all[ file ] = entry.diff.methods.length + entry.diff.properties.length +
				entry.onlyDecl.methods.length + entry.onlyDecl.properties.length +
				entry.onlyDocs.methods.length + entry.onlyDocs.properties.length;
			return all;

		}, {} )
	};

	files[ 'ObjDecl' ] = {
		files: Object.keys( checkResults[ 'compareDeclarationsWithInstancedObjects' ][ 'results' ] ).reduce( ( all, file ) => {

			const entry = checkResults[ 'compareDeclarationsWithInstancedObjects' ][ 'results' ][ file ][ 'results' ];

			all[ file ] = Object.keys( entry ).reduce( ( total, klass ) =>
				total += entry[ klass ].onlyDecl.methods.length + entry[ klass ].onlyDecl.properties.length +
					entry[ klass ].onlySource.methods.length + entry[ klass ].onlySource.properties.length
			, 0 );
			return all;

		}, {} )

	};

	files[ 'SrcDecl' ] = {
		files: Object.keys( checkResults[ 'compareDeclarationsWithSource' ][ 'results' ] ).reduce( ( all, file ) => {

			if ( checkResults[ 'compareDeclarationsWithSource' ][ 'results' ][ file ][ 'results' ].length === 0 )
				return all;

			const entry = checkResults[ 'compareDeclarationsWithSource' ][ 'results' ][ file ][ 'results' ][ 0 ];

			all[ file ] =
				entry.onlyDecl.methods.length + entry.onlyDecl.properties.length +
				entry.onlySource.methods.length + entry.onlySource.properties.length;

			return all;

		}, {} )
	};

	// TODO:
	// files[ 'UnitTests' ] = { files: { 'UNITTESTS': checkResults[ 'UnitTests' ].failed } };


	// linters
	linters.forEach( name => {

		// FIXME: hax, somewhere this got mixed up and now look where we ended up
		const testName = name.replace( 'doobDoc', 'DoobsDoc' );

		files[ testName ] = { files: countFn( linterResults[ name ][ 'results' ] ) };

	} );


	// dependencies
	dependencies.forEach( name => {

		files[ name ] = { files: countFn( dependenciesResults[ name ][ 'results' ] ) };

	} );

	return files;

};
