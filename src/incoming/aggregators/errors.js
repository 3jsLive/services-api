/*
	count total errors per test, summed over all files that were tested
*/

module.exports = ( allResults, checks, linters, dependencies, profiles ) => {

	const errors = {};

	const errorCounterFn = ( scopedResults ) => {

		return Object.keys( scopedResults ).reduce( ( all, filename ) => {

			all += scopedResults[ filename ][ 'errors' ].length;
			return all;

		}, 0 );

	};

	// TODO: what about UnitTests task?

	Object.entries( { checks, linters, dependencies, profiles } ).forEach( ( [ category, tests ] ) => {

		tests.forEach( name => {

			if ( typeof allResults[ category ][ name ] !== 'undefined' &&
			typeof allResults[ category ][ name ][ 'results' ] !== 'undefined' &&
			allResults[ category ][ name ][ 'results' ] !== null ) {

				errors[ name ] = errorCounterFn( allResults[ category ][ name ][ 'results' ] );

			}

		} );

	} );


	return errors;

};
