var fs = require('fs');
var freeport = require('freeport');
var http = require('http');
var once = require('once');

var writePort = function(path, port, cb) {
	port += '';
	fs.open(path, 'wx', function(err, fd) {
		if (err) return cb(err);
		fs.write(fd, new Buffer(port), 0, port.length, 0, function(err) {
			if (err) return cb(err);
			fs.close(fd, cb);
		});
	});
};

var readPort = function(path, cb) {
	fs.readFile(path, 'utf-8', function(err, port) {
		if (port) return cb(null, parseInt(port));
		freeport(function(err, port) {
			if (err) return cb(err);
			writePort(path, port, function() {
				readPort(path, cb);
			});
		});
	});
};

module.exports = function(path, onserver, ready) {
	if (typeof path === 'function') return module.exports(null, path, onserver);
	if (!path) path = 'PORT';

	var onping = function(response) {
		setTimeout(function() {
			response.end();
		}, 60*1000);
	};

	var server = http.createServer();
	var emit = server.emit;

	server.emit = function(name, request, response) {
		if (name !== 'request') return emit.apply(server, arguments);
		if (request.url === '/__test__') return response.end();
		if (request.url === '/__ping__') return onping(response);
		return emit.apply(server, arguments);
	};

	ready = once(ready || function() {});

	var kick = function(tries) {
		readPort(path, function(err, port) {
			if (err) return ready(err);

			var ping = function() {
				var req = http.get('http://127.0.0.1:'+port+'/__test__', ping);

				req.setTimeout(2*60000, function() {
					req.destroy();
				});

				req.on('error', function() {
					setTimeout(function() {
						kick(0);
					}, 50);
				});
			};

			var clean = function() {
				server.removeListener('error', onerror);
				server.removeListener('listening', onlisten);
			};

			var onlisten = function() {
				clean();
				onserver(server, port);
				ready(null, port);
			};

			var onerror = function() {
				if (err && err.code !== 'EADDRINUSE') return;

				clean();

				var req = http.get('http://127.0.0.1:'+port+'/__test__', function(response) {
					ready(null, port);
					ping();
				});

				req.setTimeout(2000, function() {
					req.destroy();
				});

				req.on('error', function() {
					if (tries < 3) return kick(tries++);
					fs.unlink(path, function(err) {
						if (err) return ready(err);
						kick(0);
					});
				});
			};

			server.on('error', onerror);
			server.on('listening', onlisten);

			server.listen(port);
		});
	};

	kick(0);
};