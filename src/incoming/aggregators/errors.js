/*
	count total errors per test, summed over all files that were tested
*/

module.exports = ( checks, checkResults, linters, linterResults, dependencies, dependenciesResults ) => {

	const errors = {};

	// TODO: countFn?

	// checks
	// TODO:
	/* checks.forEach( name => {

		errors[ name ] = Object.keys( checkResults[ name ][ 'results' ] ).reduce( ( all, filename ) => {

			all += checkResults[ name ][ 'results' ][ filename ][ 'errors' ].length;
			return all;

		}, 0 );

	} ); */


	// TODO:
	// errors[ 'TSCompiler' ] = Object.keys( checkResults[ 'TSCompiler' ][ 'js' ][ 'results' ] ).reduce( ( all, filename ) => {

	// 	all += checkResults[ 'TSCompiler' ][ 'js' ][ 'results' ][ filename ][ 'errors' ].length;
	// 	return all;

	// }, 0 ) + Object.keys( checkResults[ 'TSCompiler' ][ 'dts' ][ 'results' ] ).reduce( ( all, filename ) => {

	// 	all += checkResults[ 'TSCompiler' ][ 'dts' ][ 'results' ][ filename ][ 'errors' ].length;
	// 	return all;

	// }, 0 );


	//
	// linters
	//
	linters.forEach( name => {

		// FIXME: hax, somewhere this got mixed up and now look where we ended up
		const testName = name.replace( 'doobDoc', 'DoobsDoc' );

		errors[ testName ] = Object.keys( linterResults[ name ][ 'results' ] ).reduce( ( all, filename ) => {

			all += linterResults[ name ][ 'results' ][ filename ][ 'errors' ].length;
			return all;

		}, 0 );

	} );


	//
	// dependencies
	//
	dependencies.forEach( name => {

		errors[ name ] = Object.keys( dependenciesResults[ name ][ 'results' ] ).reduce( ( all, filename ) => {

			all += dependenciesResults[ name ][ 'results' ][ filename ][ 'errors' ].length;
			return all;

		}, 0 );

	} );

	return errors;

};
