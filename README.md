# http-party

Similar in scope to [level-party](https://github.com/substack/level-party) but for http.
Allows you to run multiple http servers that share a port file and does automatic failover if
the server listening on the port crashes.

```
npm install http-party
```

[![build status](http://img.shields.io/travis/mafintosh/http-party.svg?style=flat)](http://travis-ci.org/mafintosh/http-party)
![dat](http://img.shields.io/badge/Development%20sponsored%20by-dat-green.svg?style=flat)

## Usage

``` js
var party = require('http-party');

party('./PORT', // './PORT' is the port file the servers will use to coordinate.
  function onserver(server) {
    server.on('request', function(request, response) {
      response.end('hello world from '+pid);
    })
  },
  function ready(err, port) {
    console.log('Someone is listening on', port);
  }
);
```

The PORT file defaults to `./PORT`.
Try running the above example in a folder and spawn multiple processes.

```
cd some-dir
node example.js &
node example.js &
node example.js &
node example.js &
node example.js
```

The processes should print the same port. Try curling to that port

```
curl http://127.0.0.1:PORT
```

This should print the pid of a process. Try killing that process.

```
kill PID
```

If you curl the same url again one of the other processes will be listening instead!
You can always cat the `PORT` file to figure out which port is being used.
Also since we use a regular file instead of unix sockets this should also work on windows!

If you already have a server just pass than instead of the `onserver` function

``` js
var server = http.createServer(function(req, res) {
  res.end('hello world\n')
})

server.on('listening', function() {
  console.log('Server has started')
})

party('./PORT', server, function(err, port) {
  console.log('Someone is listening on', port);
})
```

## License

MIT
