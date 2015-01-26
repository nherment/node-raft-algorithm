

var util = require('util')
var EventEmitter = require('events').EventEmitter

var Server = require('./lib/Server.js')
var State = require('./lib/State.js')
var logger = require('./lib/Logger.js')
var Loopy = require('loopy')
var _ = require('lodash')


function Raft(serverTransport) {
  EventEmitter.call(this)
  var self = this
  this._transport = serverTransport
  this._state = new State()
  this._server = new Server(this._state)
  this._nodes = []
  this._clientRequestsCallbacks = {}

  this._minElectionTimeout = 150
  this._maxElectionTimeout = 300

  this._state.on('follower', function() {
    self._becomeFollower()
  })
  this._state.on('candidate', function() {
    self._becomeCandidate()
  })
  this._state.on('leader', function() {
    self._becomeLeader()
  })
    
  this._heartbeatLoop = new Loopy({
    interval: 20,
    count: -1, // infinity
    onError: Loopy.OnError.IGNORE
  })

  this._heartbeatLoop.on('tick', function(callback) {
    var nodeCount = self._nodes.length
    var commitTreshold = Math.floor(nodeCount/2) + 1
      
    _.each(self._nodes, function(node) {
      
      var prevLogIndex = node.matchIndex()
      var prevLogTerm
      var nextIndex = node.nextIndex()
      var entries = self._state.getLogEntries(nextIndex)
      var lastIndexSent
      if(nextIndex > 0) {
        lastIndexSent = nextIndex - 1
      }
      
      var prevLogEntry = self._state.getLogEntry(prevLogIndex)
      
      if(prevLogEntry && prevLogIndex !== nextIndex) {
        prevLogTerm = prevLogEntry.term
        lastIndexSent = prevLogIndex
      } else {
        prevLogIndex = null
        prevLogTerm = null
      }
      
      logger.info('leader', self.id(),
                  'sending term:', self._state.term(),
                  'leaderId:', self._state.id(),
                  'prevLogIndex:', prevLogIndex,
                  'prevLogTerm:', prevLogTerm,
                  'lastIndexSent:', lastIndexSent,
                  'nextIndex:', nextIndex,
                  'entries:', JSON.stringify(entries))

      if((_.isUndefined(lastIndexSent) || _.isNull(lastIndexSent)) && entries.length > 0) {
        lastIndexSent = entries.length - 1
      } else {
        lastIndexSent += entries.length
      }
      if(lastIndexSent >= 0) {
        node.nextIndex(lastIndexSent+1)
      }
      
      node.appendEntries(self._state.term(),
                         self._state.id(),
                         prevLogIndex,
                         prevLogTerm,
                         entries,
                         self._state.commitIndex(),
                         function(err, response) {
        if(err) { logger.error(err) }
        
        if(response && response.id) {
          node.id(response.id)
        }
        
        if(response && response.term > self._state.term()) {
          self._state.role('follower')
        }
        
        if(response && response.ack) {
          logger.debug('ack from node', node.id(), 'nextIndex:', nextIndex, 'lastIndexSent:', lastIndexSent)
          self._state.ackLog(commitTreshold, nextIndex, lastIndexSent)
          node.matchIndex(lastIndexSent)
        }
      })
    })
    callback()
  })

  this._electionTimeout = new Loopy({
    interval: this._randomElectionTimeout(),
    count: -1, // infinity
    onError: Loopy.OnError.IGNORE
  })

  this._electionTimeout.on('tick', function(callback) {
    logger.warn('node', self._state.id(), 'electionTimeout')
    setImmediate(callback)
    if(self._state.role() === 'candidate') {
      self._state.emit('candidate')
    } else {
      self._state.role('candidate')
    }
  })

  this._transport.on('data', function(data, callback) {
    switch(data.cmd) {
        
      case 'appendEntries':
        self._electionTimeout.reset()
        self._server.appendEntries(data.term,
                                   data.leaderId,
                                   data.prevLogIndex,
                                   data.prevLogTerm,
                                   data.entries,
                                   data.leaderCommit,
                                   callback)
        break
        
      case 'requestVote':
        self._server.requestVote(data.term,
                                 data.candidateId,
                                 data.lastLogIndex,
                                 data.lastLogTerm,
                                 function(err, response) {
                                   if(response && response.voteGranted) {
                                     
                                     // TODO: step down if candidate or leader
                                     // TODO: if a server receives a RequestVote
                                     //       RPC within the minimum election timeout
                                     //       of hearing from a current leader, it
                                     //       does not update its term or grant its
                                     //       vote.
                                     //self._becomeFollower()
                                   }
                                   callback(err, response)
                                 })
        break
        
      default:
        callback(new Error('unsupported command'), undefined)
        break
        
    }
  })

  this._state.on('commit', function(commitIndex) {
    
    if(self._clientRequestsCallbacks.hasOwnProperty(commitIndex)) {
      var callback = self._clientRequestsCallbacks[commitIndex]
      delete self._clientRequestsCallbacks[commitIndex]
      callback()
    }
  })
}

util.inherits(Raft, EventEmitter)

Raft.prototype.addNode = function(node) {
  this._nodes.push(node)
}

Raft.prototype.append = function(log, callback) {
  if(!this.isLeader()) {
    return callback(new Error('Appending logs can only be done to the leader'))
  }
  var index = this._state.appendLog(log)
  if(this._clientRequestsCallbacks.hasOwnProperty(index)) {
    return callback(new Error('A callback is already registered for this log index: ' + index))
  }
  // TODO: timeout
  this._clientRequestsCallbacks[index] = callback
}

Raft.prototype._becomeLeader = function() {
  logger.info('node', this.id(), 'becoming leader')
  this._electionTimeout.stop()
  this._heartbeatLoop.start(/*now*/ true)
  this.emit('leader')
}

Raft.prototype._becomeFollower = function() {
  logger.info('node', this.id(), 'stepping down to follower')
  this._electionTimeout.start()
  this._electionTimeout.reset()
  this._heartbeatLoop.stop()
  this.emit('follower')
}

Raft.prototype._becomeCandidate = function() {
  // Candidates (§5.2):
  // - On conversion to candidate, start election:
  //    - Increment currentTerm
  //    - Vote for self
  //    - Reset election timer
  //    - Send RequestVote RPCs to all other servers
  // - If votes received from majority of servers: become leader
  // - If AppendEntries RPC received from new leader: convert to
  //   follower
  // - If election timeout elapses: start new election

  logger.info('node', this.id(), 'becoming candidate')
  this._heartbeatLoop.stop()
  this.emit('candidate')
  
  this._state.term(this._state.term() + 1)
    
  this._state.votedFor(this._state.id())
  var self = this
  this._electionTimeout.setInterval(this._randomElectionTimeout())
  if(this._electionTimeout.status() !== Loopy.Status.STARTED) {
    self._electionTimeout.start()
  }
  this._electionTimeout.reset()
  var voteCount = 1 // voted for itself
  var lastIndex = self._state.lastApplied()
  var lastLogEntry = this._state.getLogEntry(lastIndex)
  var elected = false
  _.each(this._nodes, function(node) {
      
    logger.info(self.id(), 'requesting vote from', node.id())
    node.requestVote(self._state.term(), 
                     self._state.id(),
                     lastIndex,
                     lastLogEntry ? lastLogEntry.term : 0,
                     function(err, response) {
      if(err) {
        //logger.error(err)
        return
      }
      if(response && response.id) {
        node.id(response.id)
      }
      if(response && response.voteGranted) {
        voteCount ++
      }
                         
      logger.info(self.id(),
                  'received vote.',
                  'voteCount:', voteCount,
                  'from:', node.id(),
                  'granted:', response.voteGranted)
                         
      if(!elected && voteCount > (self._nodes.length / 2)) {
        self._state.role('leader')
      }
    })
  })
}

Raft.prototype.start = function(callback) {
  var self = this
  logger.info('node', self.id(), 'starting')
  this._transport.start(function() {

    self._electionTimeout.start()
    logger.info('node', self.id(), 'started')
    if(callback) {
      callback()
    }

  })
}

Raft.prototype.stop = function(callback) {
  var self = this
  logger.info('node', self.id(), 'stopping..')
  this._heartbeatLoop.stop()
  this._electionTimeout.stop()
  this._transport.stop(function() {
    logger.info('node', self.id(), 'stopped')
    if(callback) {
      callback()
    }
  })
}

Raft.prototype.isLeader = function() {
  return this._state.role() === 'leader'
}

Raft.prototype.id = function() {
  return this._state.id()
}

/** retrieve the logs in that node, regardless of their commit status
 *
 */
Raft.prototype.logs = function(fromIndex, toIndex) {
  return this._state.getLogEntries(fromIndex, toIndex)
}
Raft.prototype.maxElectionTimeout = function(maxElectionTimeout) {
  if(maxElectionTimeout !== undefined) {
    this._maxElectionTimeout = maxElectionTimeout
  } else {
    return this._maxElectionTimeout
  }
}
Raft.prototype.minElectionTimeout = function(minElectionTimeout) {
  if(minElectionTimeout !== undefined) {
    // TODO: assert that the min is not less than the max
    this._minElectionTimeout = minElectionTimeout
  } else {
    return this._minElectionTimeout
  }
}

Raft.prototype._randomElectionTimeout = function() {
  return Math.floor(Math.random() * (this._maxElectionTimeout - this._minElectionTimeout)) +
         this._minElectionTimeout
}

module.exports = Raft
