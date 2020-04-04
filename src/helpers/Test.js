const Database = require( '../Database' );

class Test {

	constructor() {

		this.testId = - 1;
		this.group = '';
		this.name = '';
		this.description = '';
		this.text = '';
		this.available = - 1;
		this.flaky = - 1;

	}

	/**
	 * @returns {Test[]}
	 */
	static loadAll() {

		const query = Test.db.prepare( 'SELECT testId FROM tests WHERE 1' );
		const results = query.all();

		if ( ! results || results.length === 0 )
			return [];

		return results.map( r => Test.loadByTestId( r.testId ) );

	}

	static loadByTestId( testId ) {

		const query = Test.db.prepare( 'SELECT * FROM tests WHERE testId = ? LIMIT 1' );
		const result = query.get( testId );

		if ( ! result || 'testId' in result === false )
			throw new Error( `Loading test #${testId} failed, no rows returned` );

		const test = new this();

		test.testId = result.testId;
		test.group = result.group;
		test.name = result.name;
		test.description = result.description;
		test.text = result.text;
		test.available = result.available;
		test.flaky = result.flaky;

		return test;

	}

	static loadByName( name ) {

		const query = Test.db.prepare( 'SELECT * FROM tests WHERE name = ? LIMIT 1' );
		const result = query.get( name );

		if ( ! result || 'testId' in result === false )
			throw new Error( `Loading test '${name}' failed, no rows returned` );

		const test = new this();

		test.testId = result.testId;
		test.group = result.group;
		test.name = result.name;
		test.description = result.description;
		test.text = result.text;
		test.available = result.available;
		test.flaky = result.flaky;

		return test;

	}

}

// working around eslint/ts syntax issues
Test.db = Database.db;


module.exports = Test;
