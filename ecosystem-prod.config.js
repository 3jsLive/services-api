const defaults = {
	instances: 1,
	ignore_watch: [ 'node_modules' ],
	max_memory_restart: '5G'
};

module.exports = {
	apps: [ {
		name: "CI API",
		script: "./src/ci/API.js",
		...defaults
	}, {
		name: "Incoming API",
		script: "./src/incoming/API.js",
		...defaults
	}, {
		name: "Live API",
		script: "./src/live/API.js",
		...defaults
	}, {
		name: "Existance API",
		script: "./src/existance/API.js",
		...defaults
	}, {
		name: "Dependencies API",
		script: "./src/dependencies/API.js",
		...defaults
	}, {
                name: "Linkcheck API",
                script: './src/linkcheck/API.js',
                ...defaults
	} ]
};
