
var util = require('util')
var EventEmitter = require('events').EventEmitter
/** A shell to implement custom transports.
 * This is typically exposed on the follower nodes and called by the leader
 *
 * There are 2 methods: 'start' and 'stop'
 * On top of these methods, Raft expect instances to emit events through
 * like the EventEmitter API.
 *
 * When the server receives a new command, it must emit the 'data' event and
 * pass 2 arguments. The first one is the payload as sent by the client and
 * the second is a callback which itself takes 1 argument (the response). The
 * server is expected to send that response back to the client.
 */ 
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
