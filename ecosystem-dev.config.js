const defaults = {
	instances: 1,
	ignore_watch: [ 'node_modules' ],
	max_memory_restart: '2G'
};

module.exports = {
	apps: [ {
		name: "CI API",
		watch: [ './src/ci' ],
		script: "./src/ci/API.js",
		...defaults
	}, {
		name: "Incoming API",
		watch: [ './src/incoming' ],
		script: "./src/incoming/API.js",
		...defaults
	}, {
		name: "Live API",
		watch: [ './src/live' ],
		script: "./src/live/API.js",
		...defaults
	}, {
		name: "Existance API",
		watch: [ './src/existance' ],
		script: "./src/existance/API.js",
		...defaults
	}, {
		name: "Dependencies API",
		watch: [ './src/dependencies' ],
		script: "./src/dependencies/API.js",
		...defaults
	} ]
};
