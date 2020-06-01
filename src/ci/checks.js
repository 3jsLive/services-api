const { createHandler } = require( './utils' );

const category = 'checks';

module.exports = {

	// Creates a diff between docs and declaration files
	'/DocsDecl/showFile/:sha': createHandler( category, 'DocsDecl' ),

	// Creates a diff between a few selected source files and declaration files
	'/SrcDecl/showFile/:sha': createHandler( category, 'SrcDecl' ),

	// Creates a diff between class instances (if possible) and declaration files
	'/ObjDecl/showFile/:sha': createHandler( category, 'ObjDecl' ),

	// check with TypeScript compiler
	'/TSCompiler/showFile/:sha': createHandler( category, 'checkWithTSCompiler' ),

	// check docs for broken example links
	'/DocsExamples/showFile/:sha': createHandler( category, 'DocsExamples' ),

	// check docs for broken external links
	'/DocsExternals/showFile/:sha': createHandler( category, 'DocsExternals' ),

	// check non-docs for broken external links
	'/NonDocsExternals/showFile/:sha': createHandler( category, 'NonDocsExternals' ),

	// unit tests results
	'/UnitTests/showFile/:sha': createHandler( category, 'UnitTests' ),

	// compare source exports
	'/CompSrcExp/showFile/:sha': createHandler( category, 'CompSrcExp' ),

	// compare source exports
	'/CompExmplsExp/showFile/:sha': createHandler( category, 'CompExmplsExp' ),

	// compare sniffed types with declared rules
	'/LawVsReality/showFile/:sha': createHandler( category, 'LawVsReality' )

};
