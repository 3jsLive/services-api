const fs = require( 'fs' );
const path = require( 'path' );
const shell = require( 'shelljs' );

// config.api.dependencies.*
const config = require( 'rc' )( '3cidev' );

// logging
const { Signale } = require( 'signale' );
const logger = new Signale( { scope: 'History', config: { displayTimestamp: true, displayDate: true } } );



/**
 * @param {string} sha SHA of the child commit
 * @param {string?} gitDir Path to git repository. Defaults to 'config.root/config.threejsRepository'.
 * @returns {(string|null)}
 * @throws {Error}
 */
function getParent( sha, gitDir ) {

	_testSHA( sha );

	return _getAncestor( 'parent', `git rev-parse "${sha}^"`, gitDir );

}


/**
 * @param {string} sha SHA of the descendant commit
 * @param {string?} gitDir Path to git repository. Defaults to 'config.root/config.threejsRepository'.
 * @returns {(string|null)}
 * @throws {Error}
 */
function getBase( sha, gitDir ) {

	_testSHA( sha );

	return _getAncestor( 'base', `git rev-parse "${sha}^^{/(Updated builds\.|r1[0-9][0-9][^d])}"`, gitDir );

}


/**
 * @param {string} sha SHA of the commit to test
 * @param {string?} gitDir Path to git repository. Defaults to 'config.root/config.threejsRepository'.
 * @returns {(boolean|null)}
 * @throws {Error}
 */
function isBase( sha, gitDir ) {

	_testSHA( sha );

	// note: only one ^ after sha
	const result = _getAncestor( 'base', `git rev-parse "${sha}^{/(Updated builds\.|r1[0-9][0-9][^d])}"`, gitDir );

	return ( result !== null && sha === result );

}


/**
 * @param {string} sha
 * @throws {Error}
 */
function _testSHA( sha ) {

	//
	// Check SHA since we're using it verbatim in shell.exec multiple times
	//
	if ( ! sha || /^[a-f0-9]{40}$/i.test( sha ) !== true ) {

		logger.error( 'Invalid SHA:', sha );

		throw new Error( `Invalid SHA: ${sha}` );

	}

}


/**
 * @param {string} name
 * @param {string} command
 * @param {string} sha
 * @param {string?} gitDir
 * @returns {(string|null)}
 */
function _getAncestor( name, command, gitDir ) {

	//
	// Check if gitDir exists or use default if none given
	//
	if ( gitDir ) {

		if ( fs.existsSync( gitDir ) === false ) {

			logger.error( `Path does not exist: ${gitDir}` );

			throw new Error( `Path does not exist: ${gitDir}` );

		}

	} else {

		const defaultRepo = path.join( config.root, config.threejsRepository );

		logger.debug( `No gitDir given, defaulting to ${defaultRepo}` );

		gitDir = defaultRepo;

	}


	//
	// Query git
	//
	const shellResult = shell.exec( command, { encoding: 'utf8', silent: true, cwd: gitDir } );

	if ( shellResult.code !== 0 || ! shellResult.stdout ) {

		logger.error( `No ${name} commit found for '${command}'` );

		logger.debug( shellResult.code, shellResult.stdout, shellResult.stderr );

		return null;

	}


	//
	// Query was successful
	//
	const targetSha = shellResult.stdout.trim();

	if ( ! targetSha || targetSha.length !== 40 || /^[a-f0-9]{40}$/i.test( targetSha ) !== true ) {

		logger.error( `Something went wrong looking up the ${name} commit for '${command}'` );

		logger.debug( shellResult.code, shellResult.stdout, shellResult.stderr );

		return null;

	}


	return targetSha;

}

module.exports = {
	getParent,
	getBase,
	isBase
};
