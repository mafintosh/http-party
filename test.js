var tape = require('tape')
var connections = require('connections')
var freeport = require('freeport')
var http = require('http')
var os = require('os')
var path = require('path')
var party = require('./')

tape('listen on 1', function(t) {
  t.plan(3)

  var PORT = path.join(os.tmpDir(), Date.now()+'-'+process.pid+'-1')

  party(PORT,
    function onserver(server) {
      t.ok(true, 'is server')
      server.close()
    },
    function ready(err, port) {
      t.notOk(err, 'no err')
      t.ok(port, 'has port')
    }
  )
})

tape('listen on 5', function(t) {
  t.plan(15)

  var PORT = path.join(os.tmpDir(), Date.now()+'-'+process.pid+'-2')

  for (var i = 0; i < 5; i++) {
    party(PORT,
      function onserver(server) {
        t.ok(true, 'is server')
        server.close()
      },
      function ready(err, port) {
        t.notOk(err, 'no err')
        t.ok(port, 'has port')
      }
    )
  }
})

tape('listen on 5 + async crash', function(t) {
  t.plan(15)

  var PORT = path.join(os.tmpDir(), Date.now()+'-'+process.pid+'-3')
  var hasServer = false

  for (var i = 0; i < 5; i++) {
    party(PORT,
      function onserver(server) {
        var conns = connections(server)
        t.notOk(hasServer, 'no other server')
        hasServer = true
        setTimeout(function() {
          hasServer = false
          conns.destroy()
          server.close()
        }, 100)
      },
      function ready(err, port) {
        t.notOk(err, 'no err')
        t.ok(port, 'has port')
      }
    )
  }
})


tape('listen on explicit port 5 times', function(t) {
  t.plan(16)

  var hasServer = false

  freeport(function(err, port) {
    t.notOk(err, 'no err')

    for (var i = 0; i < 5; i++) {
      party(port,
        function onserver(server) {
          var conns = connections(server)
          t.notOk(hasServer, 'no other server')
          hasServer = true
          setTimeout(function() {
            hasServer = false
            conns.destroy()
            server.close()
          }, 100)
        },
        function ready(err, port) {
          t.notOk(err, 'no err')
          t.ok(port, 'has port')
        }
      )
    }
  })
})

tape('listen on 1 (server)', function(t) {
  t.plan(3)

  var server = http.createServer()
  var PORT = path.join(os.tmpDir(), Date.now()+'-'+process.pid+'-1')

  server.on('listening', function() {
    t.ok(true, 'server is listening')
    server.close()
  })

  party(PORT,
    server,
    function ready(err, port) {
      t.notOk(err, 'no err')
      t.ok(port, 'has port')
    }
  )
})
