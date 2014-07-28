var fs = require('fs')
var freeport = require('freeport')
var crypto = require('crypto')
var http = require('http')
var once = require('once')
var resolve = require('path').resolve

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
  if (typeof port === 'number') return cb(new Error('Cannot unlink port'))
  fs.unlink(port, cb)
}

var conflict = function(message) {
  var err = new Error(message)
  err.conflict = true
  return err
}

module.exports = function(path, onserver, ready) {
  if (typeof path === 'function' || typeof path === 'object') return module.exports(null, path, onserver)
  if (!path) path = 'PORT'

  var handshake = crypto.createHash('md5').update(typeof path === 'string' ? resolve(process.cwd(), path) : path.toString()).digest('hex')
  var server = typeof onserver === 'object' ? onserver : http.createServer()
  var emit = server.emit

  var visit = function(url, timeout, cb) {
    cb = once(cb)

    var req = http.get(url, function(res) {
      if (res.headers['content-type'] !== 'application/x-http-party-handshake') {
        req.destroy()
        cb(conflict('Invalid handshake'))
        return
      }

      var buf = ''
      res.setEncoding('utf-8')
      res.on('data', function(data) {
        buf += data
      })
      res.on('end', function() {
        cb(buf !== handshake && conflict('Handshake mismatch'))
      })
    })

    req.setTimeout(timeout, function() {
      req.destroy()
    })

    req.on('error', cb)
    req.on('close', function() {
      cb(new Error('Request closed prematurely'))
    })
  }

  var onpingrequest = function(req, res) {
    var end = function() {
      ontestrequest(req, res)
    }

    var onclose = function() {
      clearTimeout(timeout)
    }

    var timeout = setTimeout(end, 60*1000)
    res.on('close', onclose)
  }

  var ontestrequest = function(req, res) {
    res.setHeader('Content-Type', 'application/x-http-party-handshake')
    res.setHeader('Content-Length', Buffer.byteLength(handshake))
    res.end(handshake)
  }

  server.emit = function(name, req, res) {
    if (name !== 'request') return emit.apply(server, arguments)
    if (req.url === '/__http_party_test__') return ontestrequest(req, res)
    if (req.url === '/__http_party_ping__') return onpingrequest(req, res)
    return emit.apply(server, arguments)
  }

  ready = once(ready || noop)

  var kick = function(tries) {
    if (!tries) tries = 0

    readPort(path, function(err, port) {
      if (err) return ready(err)

      var clean = function() {
        server.removeListener('error', onerror)
        server.removeListener('listening', onlisten)
      }

      var ping = function() {
        visit('http://127.0.0.1:'+port+'/__http_party_ping__', 2*60*1000, function(err) {
          if (err) return setTimeout(kick, 50)
          ping()
        })
      }

      var onlisten = function() {
        clean()
        if (typeof onserver === 'function') onserver(server, port)
        ready(null, port)
      }

      var onerror = function() {
        if (err && err.code !== 'EADDRINUSE') {
          if (server.listeners('error').length === 1) throw err
          return
        }

        clean()
        visit('http://127.0.0.1:'+port+'/__http_party_test__', 2000, function(err) {
          if (err) {
            console.log(err, tries)
            if (tries < 3 && !err.conflict) return kick(++tries)
            unlink(path, function(err) {
              if (err) return ready(err)
              kick(0)
            })
            return
          }

          ready(null, port)
          ping()
        })
      }

      server.on('error', onerror)
      server.on('listening', onlisten)

      server.listen(port)
    })
  }

  kick(0)
}