const defaults = {
	instances: 1,
	ignore_watch: [ 'node_modules' ],
	max_memory_restart: '5G'
};

const helpers = './src/helpers';


module.exports = {
	apps: [ {
		name: "CI API",
		watch: [ './src/ci', helpers ],
		script: "./src/ci/API.js",
		...defaults
	}, {
		name: "Incoming API",
		watch: [ './src/incoming', helpers ],
		script: "./src/incoming/API.js",
		...defaults
	}, {
		name: "Live API",
		watch: [ './src/live', helpers ],
		script: "./src/live/API.js",
		...defaults
	}, {
		name: "Existance API",
		watch: [ './src/existance', helpers ],
		script: "./src/existance/API.js",
		...defaults
	}, {
		name: "Dependencies API",
		watch: [ './src/dependencies', helpers ],
		script: "./src/dependencies/API.js",
		...defaults
	} ]
};
