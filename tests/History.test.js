const path = require( 'path' );
const assert = require( 'assert' );

const config = require( 'rc' )( '3cidev' );

const History = require( '../src/helpers/History' );


describe( `helpers / History`, function () {

	describe( 'getParent', function () {

		it( 'Invalid SHA', function () {

			assert.throws( () => History.getParent( 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' ), Error );
			assert.throws( () => History.getParent( '0123456789012345678901234567890123456xxx' ), Error );
			assert.throws( () => History.getParent( '0123456789012345678901234567890123456' ), Error );

		} );

		it( 'Non-existant SHA', function () {

			const result = History.getParent( '0123456789012345678901234567890123456789' );

			assert.strictEqual( result, null );

		} );

		it( 'Non-existant gitDir', function () {

			assert.throws( () => History.getParent( '0123456789012345678901234567890123456789', '/does/not/exist/xyz' ), Error );

		} );

		it( 'Valid SHA, no gitDir', function () {

			const result = History.getParent( 'a90c4e107ff6e3b148458c96965e876f9441b147' );

			assert.strictEqual( result, '214dd9dcfc56b0d85484d6841110fe1f089ff055' );

		} );

		it( 'Valid SHA, no parent', function () {

			const result = History.getParent( '214dd9dcfc56b0d85484d6841110fe1f089ff055' );

			assert.strictEqual( result, null );

		} );

		it( 'Everything valid', function () {

			// 1 parent
			const resultSingle = History.getParent( 'a90c4e107ff6e3b148458c96965e876f9441b147', path.join( config.root, config.threejsRepository ) );
			assert.strictEqual( resultSingle, '214dd9dcfc56b0d85484d6841110fe1f089ff055' );

			// 2 parents, always gets first
			const resultDouble = History.getParent( 'd69f9a7d7cac55a4674639f259275a5119f1bc17', path.join( config.root, config.threejsRepository ) );
			assert.strictEqual( resultDouble, '37fef0bc2356b72d713b6b2515018c6e7bc7b559' );

		} );

	} );


	describe( 'getBase', function () {

		it( 'Invalid SHA', function () {

			assert.throws( () => History.getBase( 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' ), Error );
			assert.throws( () => History.getBase( '0123456789012345678901234567890123456xxx' ), Error );
			assert.throws( () => History.getBase( '0123456789012345678901234567890123456' ), Error );

		} );

		it( 'Non-existant SHA', function () {

			const result = History.getBase( '0123456789012345678901234567890123456789' );

			assert.strictEqual( result, null );

		} );

		it( 'Non-existant gitDir', function () {

			assert.throws( () => History.getBase( '0123456789012345678901234567890123456789', '/does/not/exist/xyz' ), Error );

		} );

		it( 'Valid SHA, no gitDir', function () {

			const result = History.getBase( '6f8fe9b4c45f54c81dcf7311d8f08021bf3612ae' );
			assert.strictEqual( result, '70438028775dd4d539ebdfdaf1aafd6fbcac43c7' );

		} );

		it( 'Valid SHA, no base', function () {

			const resultFirst = History.getBase( '214dd9dcfc56b0d85484d6841110fe1f089ff055' );
			assert.strictEqual( resultFirst, null );

			const resultSecond = History.getBase( 'a90c4e107ff6e3b148458c96965e876f9441b147' );
			assert.strictEqual( resultSecond, null );

		} );

		it( 'Base is release', function () {

			const result = History.getBase( '0dde0819043776d5bd7bab01e6aa229692f06fd2' );
			assert.strictEqual( result, '70438028775dd4d539ebdfdaf1aafd6fbcac43c7' );

		} );

		it( 'Base is commit', function () {

			const result = History.getBase( 'f3ed73d26ab9ff99e966d40707028222754dd6b5' );
			assert.strictEqual( result, 'cc7deb947da6451b03559a2e35e3361c1b9b3d6c' );

		} );

		it( 'Base is parent', function () {

			const result = History.getBase( '5fd51daa8de5dba126e176af33684dba3951ba5c' );
			assert.strictEqual( result, '70438028775dd4d539ebdfdaf1aafd6fbcac43c7' );

		} );

		it( 'Base is first parent', function () {

			const result = History.getBase( 'a48ecade767935743dea67154ab4fd8221d49acd' );
			assert.strictEqual( result, '70438028775dd4d539ebdfdaf1aafd6fbcac43c7' );

		} );

		it( 'Base is second parent', function () {

			const result = History.getBase( 'd51c345e0bc0ac301dae82fe937757de0aac3412' );
			assert.strictEqual( result, '71f608d9a3c09c6347b8ccdc5d331869842da41b' );

		} );

		it( 'Commit is already base', function () {

			const result = History.getBase( '70438028775dd4d539ebdfdaf1aafd6fbcac43c7' );
			assert.strictEqual( result, '4834fc7b289dccf713e94abda5852eebb8bae2f1' );

		} );

	} );


	describe( 'isBase', function () {

		it( 'Invalid SHA', function () {

			assert.throws( () => History.isBase( 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' ), Error );
			assert.throws( () => History.isBase( '0123456789012345678901234567890123456xxx' ), Error );
			assert.throws( () => History.isBase( '0123456789012345678901234567890123456' ), Error );

		} );

		it( 'Non-existant SHA', function () {

			const result = History.isBase( '0123456789012345678901234567890123456789' );

			assert.strictEqual( result, false );

		} );

		it( 'Non-existant gitDir', function () {

			assert.throws( () => History.isBase( '0123456789012345678901234567890123456789', '/does/not/exist/xyz' ), Error );

		} );

		it( 'Valid SHA, no gitDir', function () {

			const result = History.isBase( '6f8fe9b4c45f54c81dcf7311d8f08021bf3612ae' );
			assert.strictEqual( result, false );

		} );

		it( 'Valid SHA, no base', function () {

			const resultFirst = History.isBase( '214dd9dcfc56b0d85484d6841110fe1f089ff055' );
			assert.strictEqual( resultFirst, false );

			const resultSecond = History.isBase( 'a90c4e107ff6e3b148458c96965e876f9441b147' );
			assert.strictEqual( resultSecond, false );

		} );

		it( 'Base is an earlier release', function () {

			const result = History.isBase( '0dde0819043776d5bd7bab01e6aa229692f06fd2' );
			assert.strictEqual( result, false );

		} );

		it( 'Base is an earlier commit', function () {

			const result = History.isBase( 'f3ed73d26ab9ff99e966d40707028222754dd6b5' );
			assert.strictEqual( result, false );

		} );

		it( 'Base as a parent', function () {

			// only one parent
			const resultSingle = History.isBase( '5fd51daa8de5dba126e176af33684dba3951ba5c' );
			assert.strictEqual( resultSingle, false );

			// two parents, first one is base
			const resultFirst = History.isBase( 'a48ecade767935743dea67154ab4fd8221d49acd' );
			assert.strictEqual( resultFirst, false );

			// two parents, second one is base
			const resultSecond = History.isBase( 'd51c345e0bc0ac301dae82fe937757de0aac3412' );
			assert.strictEqual( resultSecond, false );

		} );

		it( 'Commit indeed is base', function () {

			const resultRelease = History.isBase( '70438028775dd4d539ebdfdaf1aafd6fbcac43c7' );
			assert.strictEqual( resultRelease, true );

			const resultUpdatedBuilds = History.isBase( '4834fc7b289dccf713e94abda5852eebb8bae2f1' );
			assert.strictEqual( resultUpdatedBuilds, true );

		} );

	} );

} );
