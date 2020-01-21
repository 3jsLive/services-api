const { createHandler } = require( './utils' );

const category = 'checks';

module.exports = {

	// Creates a diff between docs and declaration files
	'/docsdecl/showFile/:sha': createHandler( category, 'compareDeclarationsWithDocs' ),

	// Creates a diff between a few selected source files and declaration files
	'/srcdecl/showFile/:sha': createHandler( category, 'compareDeclarationsWithSource' ),

	// Creates a diff between class instances (if possible) and declaration files
	'/objdecl/showFile/:sha': createHandler( category, 'compareDeclarationsWithInstancedObjects' ),

	// check with TypeScript compiler
	'/checkWithTS/showFile/:sha': createHandler( category, 'checkWithTSCompiler' ),

	// check docs for broken example links
	'/checkDocsExamples/showFile/:sha': createHandler( category, 'checkDocsForBrokenExampleLinks' ),

	// check docs for broken external links
	'/checkDocsExternals/showFile/:sha': createHandler( category, 'checkDocsForBrokenExternalLinks' ),

	// check non-docs for broken external links
	'/checkNonDocsExternals/showFile/:sha': createHandler( category, 'checkNonDocsForBrokenExternalLinks' ),

	// unit tests results
	'/checkUnitTests/showFile/:sha': createHandler( category, 'runUnitTests' ),

	// compare source exports
	'/compareSourceExports/showFile/:sha': createHandler( category, 'compareSourceExports' ),

	// compare source exports
	'/compareExamplesExports/showFile/:sha': createHandler( category, 'compareExamplesExports' )

};
