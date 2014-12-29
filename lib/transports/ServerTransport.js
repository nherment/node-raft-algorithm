
var util = require('util')
var EventEmitter = require('events').EventEmitter

function ServerTransport() {
  EventEmitter.call(this)
}

util.inherits(ServerTransport, EventEmitter)

ServerTransport.prototype.start = function(callback) {
  if(this._start) {
    this._start(callback)
  } else {
    setImmediate(callback)
  }
}

ServerTransport.prototype.stop = function(callback) {
  if(this._stop) {
    this._stop(callback)
  } else {
    setImmediate(callback)
  }
}

module.exports = ServerTransport
