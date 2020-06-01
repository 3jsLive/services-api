/*
	the overview is the big table on a run's main page
	listing the current run's results in comparison to
	the parent as well as the current run's baseline.
*/

module.exports = ( allResults, checks, linters, dependencies, profiles ) => {

	const overview = {};

	Object.entries( { checks, linters, dependencies, profiles } ).forEach( ( [ category, tests ] ) => {

		tests.forEach( name => {

			if ( typeof allResults[ category ][ name ] !== 'undefined' &&
			typeof allResults[ category ][ name ][ 'hits' ] !== 'undefined' &&
			allResults[ category ][ name ][ 'hits' ] !== null ) {

				overview[ name ] = { result: allResults[ category ][ name ][ 'hits' ] };

			}

		} );


	} );

	if ( typeof allResults.checks[ 'UnitTests' ] !== 'undefined' &&
		typeof allResults.checks[ 'UnitTests' ][ 'failed' ] !== 'undefined' ) {

		overview[ 'UnitTests' ] = { result: allResults.checks[ 'UnitTests' ].failed };

	}


	// TODO: adapt
	// overview[ 'LawVsReality' ] = { result: Object.keys( checkResults[ 'LawVsReality' ] ).reduce( ( all, functions ) => all += functions.length, 0 ) };

	// TODO:
	// overview[ 'TSCompiler' ] = { result:
	// countFn( checkResults[ 'checkWithTSCompiler' ][ 'js' ][ 'results' ] ) + countFn( checkResults[ 'checkWithTSCompiler' ][ 'dts' ][ 'results' ] )
	// };


	return overview;

};
