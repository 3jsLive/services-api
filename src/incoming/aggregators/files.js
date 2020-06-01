/*
	count hits per file, e.g. test 'check for broken links' found 4 broken links in foo.html -> foo.html: 4
*/

module.exports = ( allResults, checks, linters, dependencies, profiles ) => {

	const files = {};

	const hitsCounterFn = ( scopedResults ) => {

		return Object.entries( scopedResults ).reduce( ( all, [ file, results ] ) => {

			all[ file ] = results.hits;

			return all;

		}, {} );

	};


	Object.entries( { checks, linters, dependencies, profiles } ).forEach( ( [ category, tests ] ) => {

		tests.forEach( name => {

			if ( typeof allResults[ category ][ name ] !== 'undefined' &&
			typeof allResults[ category ][ name ][ 'results' ] !== 'undefined' &&
			allResults[ category ][ name ][ 'results' ] !== null ) {

				files[ name ] = { files: hitsCounterFn( allResults[ category ][ name ][ 'results' ] ) };

			}

		} );

	} );

	if ( typeof allResults.checks[ 'UnitTests' ] !== 'undefined' &&
		typeof allResults.checks[ 'UnitTests' ][ 'failed' ] !== 'undefined' ) {

		files[ 'UnitTests' ] = { files: { 'UNITTESTS': allResults.checks[ 'UnitTests' ].failed } };

	}

	// TODO: adapt
	/* files[ 'LawVsReality' ] = { files: Object.entries( checkResults[ 'LawVsReality' ] ).reduce( ( all, [ file, results ] ) => {

		// all[ file ] = results.functions.length;
		all[ file ] = results.hits;//functions.length;
		return all;

	}, {} ) }; */

	// TODO:
	// files[ 'TSCompiler' ] = {
	// 	files: Object.assign( {},
	// 		countFn( checkResults[ 'TSCompiler' ][ 'js' ][ 'results' ] ),
	// 		countFn( checkResults[ 'TSCompiler' ][ 'dts' ][ 'results' ] )
	// 	)
	// };


	return files;

};
