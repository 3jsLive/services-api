const path = require( 'path' );
const t = require( 'tap' );

const config = require( 'rc' )( '3cidev' );

// disable logging
const sinon = require( 'sinon' );
const Signale = require( 'signale' );
const stub = sinon.stub( Signale.Signale );
stub.prototype._logger = () => {};

const History = require( '../src/helpers/History' );

t.test( `helpers / History`, t => {

	t.test( 'getParent', t => {

		t.test( 'Invalid SHA', t => {

			t.throws( () => History.getParent( 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' ), Error );
			t.throws( () => History.getParent( '0123456789012345678901234567890123456xxx' ), Error );
			t.throws( () => History.getParent( '0123456789012345678901234567890123456' ), Error );

			t.end();

		} );

		t.test( 'Non-existant SHA', t => {

			const result = History.getParent( '0123456789012345678901234567890123456789' );

			t.strictEqual( result, null );

			t.end();

		} );

		t.test( 'Non-existant gitDir', t => {

			t.throws( () => History.getParent( '0123456789012345678901234567890123456789', '/does/not/exist/xyz' ), Error );

			t.end();

		} );

		t.test( 'Valid SHA, no gitDir', t => {

			const result = History.getParent( 'a90c4e107ff6e3b148458c96965e876f9441b147' );

			t.strictEqual( result, '214dd9dcfc56b0d85484d6841110fe1f089ff055' );

			t.end();

		} );

		t.test( 'Valid SHA, no parent', t => {

			const result = History.getParent( '214dd9dcfc56b0d85484d6841110fe1f089ff055' );

			t.strictEqual( result, null );

			t.end();

		} );

		t.test( 'Everything valid', t => {

			// 1 parent
			const resultSingle = History.getParent( 'a90c4e107ff6e3b148458c96965e876f9441b147', path.join( config.root, config.threejsRepository ) );
			t.strictEqual( resultSingle, '214dd9dcfc56b0d85484d6841110fe1f089ff055' );

			// 2 parents, always gets first
			const resultDouble = History.getParent( 'd69f9a7d7cac55a4674639f259275a5119f1bc17', path.join( config.root, config.threejsRepository ) );
			t.strictEqual( resultDouble, '37fef0bc2356b72d713b6b2515018c6e7bc7b559' );

			t.end();

		} );

		t.end();

	} );


	t.test( 'getBase', t => {

		t.test( 'Invalid SHA', t => {

			t.throws( () => History.getBase( 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' ), Error );
			t.throws( () => History.getBase( '0123456789012345678901234567890123456xxx' ), Error );
			t.throws( () => History.getBase( '0123456789012345678901234567890123456' ), Error );

			t.end();

		} );

		t.test( 'Non-existant SHA', t => {

			const result = History.getBase( '0123456789012345678901234567890123456789' );

			t.strictEqual( result, null );

			t.end();

		} );

		t.test( 'Non-existant gitDir', t => {

			t.throws( () => History.getBase( '0123456789012345678901234567890123456789', '/does/not/exist/xyz' ), Error );

			t.end();

		} );

		t.test( 'Valid SHA, no gitDir', t => {

			const result = History.getBase( '6f8fe9b4c45f54c81dcf7311d8f08021bf3612ae' );
			t.strictEqual( result, '70438028775dd4d539ebdfdaf1aafd6fbcac43c7' );

			t.end();

		} );

		t.test( 'Valid SHA, no base', t => {

			const resultFirst = History.getBase( '214dd9dcfc56b0d85484d6841110fe1f089ff055' );
			t.strictEqual( resultFirst, null );

			const resultSecond = History.getBase( 'a90c4e107ff6e3b148458c96965e876f9441b147' );
			t.strictEqual( resultSecond, null );

			t.end();

		} );

		t.test( 'Base is release', t => {

			const result = History.getBase( '0dde0819043776d5bd7bab01e6aa229692f06fd2' );
			t.strictEqual( result, '70438028775dd4d539ebdfdaf1aafd6fbcac43c7' );

			t.end();

		} );

		t.test( 'Base is commit', t => {

			const result = History.getBase( 'f3ed73d26ab9ff99e966d40707028222754dd6b5' );
			t.strictEqual( result, 'cc7deb947da6451b03559a2e35e3361c1b9b3d6c' );

			t.end();

		} );

		t.test( 'Base is parent', t => {

			const result = History.getBase( '5fd51daa8de5dba126e176af33684dba3951ba5c' );
			t.strictEqual( result, '70438028775dd4d539ebdfdaf1aafd6fbcac43c7' );

			t.end();

		} );

		t.test( 'Base is first parent', t => {

			const result = History.getBase( 'a48ecade767935743dea67154ab4fd8221d49acd' );
			t.strictEqual( result, '70438028775dd4d539ebdfdaf1aafd6fbcac43c7' );

			t.end();

		} );

		t.test( 'Base is second parent', t => {

			const result = History.getBase( 'd51c345e0bc0ac301dae82fe937757de0aac3412' );
			t.strictEqual( result, '71f608d9a3c09c6347b8ccdc5d331869842da41b' );

			t.end();

		} );

		t.test( 'Commit is already base', t => {

			const result = History.getBase( '70438028775dd4d539ebdfdaf1aafd6fbcac43c7' );
			t.strictEqual( result, '4834fc7b289dccf713e94abda5852eebb8bae2f1' );

			t.end();

		} );

		t.end();

	} );


	t.test( 'isBase', t => {

		t.test( 'Invalid SHA', t => {

			t.throws( () => History.isBase( 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' ), Error );
			t.throws( () => History.isBase( '0123456789012345678901234567890123456xxx' ), Error );
			t.throws( () => History.isBase( '0123456789012345678901234567890123456' ), Error );

			t.end();

		} );

		t.test( 'Non-existant SHA', t => {

			const result = History.isBase( '0123456789012345678901234567890123456789' );

			t.strictEqual( result, false );

			t.end();

		} );

		t.test( 'Non-existant gitDir', t => {

			t.throws( () => History.isBase( '0123456789012345678901234567890123456789', '/does/not/exist/xyz' ), Error );

			t.end();

		} );

		t.test( 'Valid SHA, no gitDir', t => {

			const result = History.isBase( '6f8fe9b4c45f54c81dcf7311d8f08021bf3612ae' );
			t.strictEqual( result, false );

			t.end();

		} );

		t.test( 'Valid SHA, no base', t => {

			const resultFirst = History.isBase( '214dd9dcfc56b0d85484d6841110fe1f089ff055' );
			t.strictEqual( resultFirst, false );

			const resultSecond = History.isBase( 'a90c4e107ff6e3b148458c96965e876f9441b147' );
			t.strictEqual( resultSecond, false );

			t.end();

		} );

		t.test( 'Base is an earlier release', t => {

			const result = History.isBase( '0dde0819043776d5bd7bab01e6aa229692f06fd2' );
			t.strictEqual( result, false );

			t.end();

		} );

		t.test( 'Base is an earlier commit', t => {

			const result = History.isBase( 'f3ed73d26ab9ff99e966d40707028222754dd6b5' );
			t.strictEqual( result, false );

			t.end();

		} );

		t.test( 'Base as a parent', t => {

			// only one parent
			const resultSingle = History.isBase( '5fd51daa8de5dba126e176af33684dba3951ba5c' );
			t.strictEqual( resultSingle, false );

			// two parents, first one is base
			const resultFirst = History.isBase( 'a48ecade767935743dea67154ab4fd8221d49acd' );
			t.strictEqual( resultFirst, false );

			// two parents, second one is base
			const resultSecond = History.isBase( 'd51c345e0bc0ac301dae82fe937757de0aac3412' );
			t.strictEqual( resultSecond, false );

			t.end();

		} );

		t.test( 'Commit indeed is base', t => {

			const resultRelease = History.isBase( '70438028775dd4d539ebdfdaf1aafd6fbcac43c7' );
			t.strictEqual( resultRelease, true );

			const resultUpdatedBuilds = History.isBase( '4834fc7b289dccf713e94abda5852eebb8bae2f1' );
			t.strictEqual( resultUpdatedBuilds, true );

			t.end();

		} );

		t.end();

	} );

	t.end();

} );
