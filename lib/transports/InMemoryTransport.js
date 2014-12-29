
var ServerTransport = require('./ServerTransport.js')

var util = require('util')

function InMemoryTransport(server) {
  ServerTransport.call(this)
}

util.inherits(InMemoryTransport, ServerTransport)

InMemoryTransport.prototype._send = function(data, callback) {
  if(this._running) {
    this.emit('data', data, callback)
  } else {
    setImmediate(function() {
      callback(new Error('not running'), undefined)
    })
  }
}

InMemoryTransport.prototype.send = InMemoryTransport.prototype._send

InMemoryTransport.prototype._start = function(callback) {
  this._running = true
  setImmediate(callback)
}

InMemoryTransport.prototype._stop = function(callback) {
  this._running = false
  setImmediate(callback)
}

module.exports = InMemoryTransport
