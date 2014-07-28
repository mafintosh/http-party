var party = require('./');

party('PORT',
	function(server) {
		console.log('yo im a server now')
		server.on('request', function(request, response) {
			response.end('hello world from '+process.pid+'\n');
		});
	},
	function(err, port) {
		console.log('Listening on', port);
	}
);
