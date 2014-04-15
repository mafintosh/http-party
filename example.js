var party = require('./');

party('PORT',
	function(server) {
		server.on('request', function(request, response) {
			response.end('hello world?');
		});
	},
	function(err, port) {
		console.log('Listening on', port);
	}
);