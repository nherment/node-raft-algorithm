
var logger = require('./Logger.js')

var util = require('util')
var EventEmitter = require('events').EventEmitter
var uuid = require('uuid')

// don't start at an id which is falsy because the check if the node has
// already voted for someone checks if the votedFor is truthy
var _id = 1
function id() {
  return _id++
}
uuid.v4 = id

function State() {
  EventEmitter.call(this)

  //--------------------------------------------------------------------------//
  //--                     Persistent state on all servers                  --//
  //--------------------------------------------------------------------------//
  // (Updated on stable storage before responding to RPCs)

  this._id = uuid.v4()
    
  //latest term server has seen (initialized to 0 on first boot, increases
  // monotonically)
  this._term = 0

  // candidateId that received vote in current term (or null if none)
  this._votedFor = null

  // log entries; each entry contains command for state machine, and term when
  // entry was received by leader (first index is 1)
  this._log = []

  //--------------------------------------------------------------------------//
  //--                      Volatile state on all servers                   --//
  //--------------------------------------------------------------------------//

  // index of highest log entry known to be committed (initialized to 0,
  // increases monotonically)
  this._commitIndex = 0

  // index of highest log entry applied to state machine (initialized to 0,
  // increases monotonically)
  this._lastApplied = 0

  this._leaderId = null

  this._role = 'follower'
}

util.inherits(State, EventEmitter)

State.prototype.term = function(term) {
  if(term !== undefined) {
    this._term = term
  } else {
    return this._term
  }
}

State.prototype.votedFor = function(votedFor) {
  if(votedFor !== undefined) {
    this._votedFor = votedFor
  } else {
    return this._votedFor
  }
}

State.prototype.lastApplied = function(lastApplied) {
  if(lastApplied !== undefined) {
    this._lastApplied = lastApplied
  } else {
    return this._lastApplied
  }
}

State.prototype.commitIndex = function(commitIndex) {
  if(commitIndex !== undefined) {
    this._commitIndex = commitIndex
  } else {
    return this._commitIndex
  }
}

State.prototype.leaderId = function(leaderId) {
  if(leaderId !== undefined) {
    this._leaderId = leaderId
  } else {
    return this._leaderId
  }
}

State.prototype.appendLog = function(log) {
  var entry = {
    value: log,
    replicationCount: 1,
    committed: false,
    term: this.term()
  }
  this._log.push(entry)
  this._lastApplied = this._log.length - 1
  return this._lastApplied
}

State.prototype.appendRawLogs = function(rawLogs) {
  if(rawLogs) {
    this._log = this._log.concat(rawLogs)
  }
}

State.prototype.ackLog = function(commitTreshold, indexFrom, indexTo) {
  for(var i = indexFrom ; i <= indexTo ; i++) {
    var logEntry = this._log[i]
    if(!logEntry) {
      logger.debug('no log entry at', i)
      continue
    }
    logEntry.replicationCount ++
    if(!logEntry.committed && logEntry.replicationCount >= commitTreshold) {
      logEntry.committed = true
      this.commitIndex(i)
      this.emit('commit', i)
    }
  }
}

State.prototype.getLogEntry = function(index) {
  return this._log[index]
}

State.prototype.getLogEntries = function(fromIndex, toIndex) {
  return this._log.slice(fromIndex, toIndex)
}

State.prototype.id = function() {
  return this._id
}

State.prototype.role = function(role) {
  if(role !== undefined) {
    // TODO: enforce one of 'follower', 'candidate', 'leader'
    if(this._role != role) {
      this._role = role
      this.emit(role)
    }
  } else {
    return this._role
  }
}

module.exports = State
