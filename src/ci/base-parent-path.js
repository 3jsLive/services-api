const graphlib = require( 'graphlib' );
const shelljs = require( 'shelljs' );
const _path = require( 'path' );
const config = require( 'rc' )( 'baseParentPath', {
	basePath: '/home/max/dev/_projects/3js-clean/'
} );


function distance( graph, start, end ) {

	return graphlib.alg.dijkstra( graph, start )[ end ].distance;

}


function main() {

	const gitstruct = shelljs.exec(
		// `git --git-dir=${config.basePath}.git rev-list --branches=dev --date-order --max-age=1556133894 --oneline --parents --no-abbrev HEAD | tac`,
		`git --git-dir=${config.basePath}.git rev-list --branches=dev --date-order --max-age=${1556133894 - 60 * 60 * 24 * 365} --oneline --parents --no-abbrev HEAD | tac`,
		// 'git --git-dir=/tmp/tmp.WSB0cNgGB7/.git rev-list --branches=master --date-order --oneline --parents --no-abbrev HEAD | tac',
		// 'git --git-dir=/tmp/tmp.6qQEkeOhg9/.git rev-list --branches=master --date-order --oneline --parents --no-abbrev HEAD | tac',
		{ encoding: 'utf8', windowsHide: true, silent: true }
	);

	// const r104 = '93e72ba7b24958ddb0652bd33171edd14ed2d693';

	let g = new graphlib.Graph( { directed: true, compound: true, multigraph: true } );
	let currentBase = '';
	let bases = [];

	for ( const line of gitstruct.stdout.trim().split( '\n' ) ) {

		let hashes = [];
		let summary = [];

		for ( const part of line.trim().split( ' ' ) ) {

			if ( ! part )
				break;

			if ( /^[a-f0-9]{40}$/.test( part ) === true )
				hashes.push( part );
			else
				summary.push( part );

		}

		const self = hashes[ 0 ];
		const parent1 = hashes[ 1 ];
		const parent2 = ( hashes.length === 3 ) ? hashes[ 2 ] : null;

		const text = summary.join( ' ' ).trim();

		g.setEdge( self, parent1, 'Parent1' );

		if ( parent2 )
			g.setEdge( self, parent2, 'Parent2' );

		if ( currentBase !== '' && currentBase !== self )
			g.setParent( self, currentBase );

		if ( /^Updated builds.$/i.test( text ) === true || /^r1[0-9]{2}$/.test( text ) === true ) {

			// if ( /^(B|C)$/.test( text ) === true ) {
			// if ( /^(C|F)$/.test( text ) === true ) {

			g.setNode( self, 'BASE' );

			currentBase = self;

			bases.push( self );

		}

	}

	return { graph: g, bases };

}

// console.log( reachable( g, r104, '5fdb124534020d9df9cd8af4284f791f661d9caa' ) );
// console.log( reachable( g, '5fdb124534020d9df9cd8af4284f791f661d9caa', r104 ) );

// const start = '289185ad005cfd008d39ae10c5d7b039c3d93129';

// let distances = bases.map( base => ( { base, distance: distance( g, start, base ) } ) );
// distances.sort( ( a, b ) => a.distance - b.distance );
// if ( distances[ 0 ].distance === Infinity )
// 	console.log( 'no base reachable' );
// else
// console.log( start, distances[ 0 ] );

// simple CLI-fication
if ( require.main === module ) {

	if ( process.argv.length != 4 ) {

		console.error( 'Invalid number of arguments' );

		console.log( `Usage: ${_path.basename( process.argv[ 0 ] )} ${process.argv[ 1 ]} <base, path or parent> <SHA>` );

		process.exit( - 1 );

	}


	// setup
	// eslint-disable-next-line no-unused-vars
	const [ node, script, mode, start ] = process.argv;

	const { graph, bases } = main();

	if ( /^parent$/i.test( mode ) ) {

		// const parent = graph.parent( start );
		// graph.

		// if ( parent )
		// 	console.log( parent );
		// else
		// 	console.log( '' );
		// console.log( graph.outEdges( start ) );
		// console.log( graph.successors( start ) );

		console.log( parent( start ) );

	} else if ( /^base$/i.test( mode ) ) {

		// const distances = bases
		// 	.map( base => ( { base, distance: distance( graph, start, base ) } ) )
		// 	.sort( ( a, b ) => a.distance - b.distance );

		// if ( distances[ 0 ].distance === Infinity )
		// 	console.log( '' );
		// else
		// 	console.log( 'my method', distances[ 0 ].base );

		console.log( base( start ) );

	} else if ( /^ancestry$/i.test( mode ) ) {

		const result = ancestry( start );

		console.log( JSON.stringify( result ) );

	} else if ( /^path$/i.test( mode ) ) {

		console.log( path( start ).join( '\n' ) );

	} else if ( mode === 'graphviz' ) {

		console.log( graphlib.json.write( graph ).edges.map( edge => `"${edge.v}" -> "${edge.w}";` ).join( '\n' ) );

		const paths = graphlib.alg.dijkstra( graph, start );

		let path = [];
		let current = graph.parent( start );
		while ( current !== start ) {

			path.push( current );

			current = paths[ current ].predecessor;

			if ( path.length > 100 )
				break;

		}

		path.forEach( node => console.log( `"${node}" [color=blue,style=filled];` ) );

		const distances = bases
			.map( base => ( { base, distance: distance( graph, start, base ) } ) )
			.sort( ( a, b ) => a.distance - b.distance );

		path = [];
		current = distances[ 0 ].base;
		while ( current !== start ) {

			path.push( current );

			current = paths[ current ].predecessor;

			if ( path.length > 100 )
				break;

		}

		path.forEach( node => console.log( `"${node}" [color=green,style=filled];` ) );

		graphlib.json.write( graph ).nodes.forEach( node => {

			if ( node.value === 'BASE' )
				console.log( `"${node.v}" [color=red,style=filled];` );

		} );

		console.log( graphlib.alg.topsort( graph ).join( '\n' ) );


		const dot = require( 'graphlib-dot' );
		console.log( '----------------------------\n', dot.write( graph ) );


	} else if ( mode === 'graphviz2' ) {

		console.log( graphlib.json.write( graph ).edges.map( edge => `"${edge.v}" -> "${edge.w}";` ).join( '\n' ) );

		const paths = graphlib.alg.dijkstra( graph, start );

		let path = [];
		let current = graph.parent( start );

		while ( current !== start ) {

			path.push( current );

			current = paths[ current ].predecessor;

			if ( path.length > 100 )
				break;

		}

		path.forEach( node => console.log( `"${node}" [color=blue,style=filled];` ) );

		const distances = bases
			.map( base => ( { base, distance: distance( graph, start, base ) } ) )
			.sort( ( a, b ) => a.distance - b.distance );

		path = [];
		current = distances[ 0 ].base;
		while ( current !== start ) {

			path.push( current );

			current = paths[ current ].predecessor;

			if ( path.length > 100 )
				break;

		}

		path.forEach( node => console.log( `"${node}" [color=green,style=filled];` ) );

		graphlib.json.write( graph ).nodes.forEach( node => {

			if ( node.value === 'BASE' )
				console.log( `"${node.v}" [color=red,style=filled];` );

		} );

		console.log( graphlib.alg.topsort( graph ).join( '\n' ) );

	} else {

		console.error( `Unknown mode: ${mode}` );
		process.exit( - 1 );

	}

	process.exit( 0 );

}


function path( start ) {

	const { graph } = main();

	const paths = graphlib.alg.dijkstra( graph, start );

	let path = [];
	let current = graph.parent( start );
	while ( current !== start ) {

		path.push( current );

		current = paths[ current ].predecessor;

		if ( path.length > 255 )
			break;

	}

	return path;

}


function base( start ) {

	const { graph } = main();

	return graph.parent( start );

}


function parent( start ) {

	const { graph } = main();

	let retval;

	graph.outEdges( start ).forEach( ( { v, w } ) => {

		if ( graph.edge( v, w ) === 'Parent1' )
			retval = w;

	} );

	return retval;

}


function ancestry( start ) {

	if ( /^[a-f0-9]{40}$/i.test( start ) !== true )
		return;

	const { bases } = main();

	const ancestry = shelljs.exec( `git --git-dir=${config.basePath}.git rev-list --ancestry-path --max-age=1556133894 --no-abbrev r104^1..${start}`, { encoding: 'utf8', timeout: 30000, silent: true } );

	const candidates = ancestry.stdout.trim().split( /\n/g );

	const final = bases.reduce( ( earliest, base ) => {

		const index = candidates.indexOf( base );

		if ( index === - 1 )
			return earliest;

		if ( index < earliest.index ) {

			earliest.index = index;
			earliest.sha = base;

		}

		return earliest;

	}, { index: Infinity, sha: '' } );

	return { base: final.sha, path: candidates.slice( 0, final.index ) };

}

module.exports = { path, base, parent, ancestry };
