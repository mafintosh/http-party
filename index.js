var fs = require('fs')
var freeport = require('freeport')
var http = require('http')
var once = require('once')

var noop = function() {}

var writePort = function(path, port, cb) {
  port += ''
  fs.open(path, 'wx', function(err, fd) {
    if (err) return cb(err)
    fs.write(fd, new Buffer(port), 0, port.length, 0, function(err) {
      if (err) return cb(err)
      fs.close(fd, cb)
    })
  })
}

var readPort = function(path, cb) {
  if (typeof path === 'number') return cb(null, path)
  fs.readFile(path, 'utf-8', function(err, port) {
    if (port) return cb(null, parseInt(port))
    freeport(function(err, port) {
      if (err) return cb(err)
      writePort(path, port, function() {
        readPort(path, cb)
      })
    })
  })
}

var unlink = function(port, cb) {
  if (typeof port === 'number') return cb()
  fs.unlink(port, cb)
}

module.exports = function(path, onserver, ready) {
  if (typeof path === 'function') return module.exports(null, null, path, opts)
  if (!path) path = 'PORT'

  var server = http.createServer()
  var emit = server.emit

  var onpingrequest = function(req, res) {
    var end = function() {
      res.end()
    }

    var onclose = function() {
      clearTimeout(timeout)
    }

    var timeout = setTimeout(end, 60*1000)
    res.on('close', onclose)
  }

  var ontestrequest = function(req, res) {
    res.end()
  }

  server.emit = function(name, req, res) {
    if (name !== 'request') return emit.apply(server, arguments)
    if (req.url === '/__test__') return ontestrequest(req, res)
    if (req.url === '/__ping__') return onpingrequest(req, res)
    return emit.apply(server, arguments)
  }

  ready = once(ready || noop)

  var kick = function(tries) {
    if (!tries) tries = 0

    readPort(path, function(err, port) {
      if (err) return ready(err)

      var onpingresponse = function(res) {
        res.resume()
        res.on('end', ping)
      }

      var ping = function() {
        var req = http.get('http://127.0.0.1:'+port+'/__ping__', onpingresponse)

        req.setTimeout(2*60000, function() {
          req.destroy()
        })

        req.on('error', function() {
          setTimeout(kick, 50)
        })
      }

      var clean = function() {
        server.removeListener('error', onerror)
        server.removeListener('listening', onlisten)
      }

      var onlisten = function() {
        clean()
        onserver(server, port)
        ready(null, port)
      }

      var onerror = function() {
        if (err && err.code !== 'EADDRINUSE') return

        clean()

        var req = http.get('http://127.0.0.1:'+port+'/__test__', function(res) {
          res.resume()
          res.on('end', function() {
            ready(null, port)
            ping()
          })
        })

        req.setTimeout(2000, function() {
          req.destroy()
        })

        req.on('error', function() {
          if (tries < 3) return kick(tries++)
          unlink(path, function(err) {
            if (err) return ready(err)
            kick(0)
          })
        })
      }

      server.on('error', onerror)
      server.on('listening', onlisten)

      server.listen(port)
    })
  }

  kick(0)
}