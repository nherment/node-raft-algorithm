
var Server = require('./lib/Server.js')
var State = require('./lib/State.js')
var logger = require('./lib/Logger.js')
var Loopy = require('loopy')
var _ = require('lodash')


function Raft(serverTransport) {
  var self = this
  this._transport = serverTransport
  this._state = new State()
  this._server = new Server(this._state)
  this._nodes = []
  this._clientRequestsCallbacks = {}
    
  this._heartbeatLoop = new Loopy({
    interval: 20,
    count: -1, // infinity
    onError: Loopy.OnError.IGNORE
  })

  this._heartbeatLoop.on('tick', function(callback) {
    logger.debug(self._state.id(), 'heartbeatLoop')
    var nodeCount = self._nodes.length
    var commitTreshold = Math.floor(nodeCount/2) + 1
      
    _.each(self._nodes, function(node) {
      
      var prevLogIndex = node.matchIndex()
      var prevLogTerm
      var nextIndex = node.nextIndex() || 0
      var entries = self._state.getLogEntries(nextIndex)
      var lastIndexSent = Math.max( nextIndex - 1, 0 )
      
      var prevLogEntry = self._state.getLogEntry(prevLogIndex)
      
      if(prevLogEntry && prevLogIndex !== nextIndex) {
        prevLogTerm = prevLogEntry.term
        lastIndexSent = prevLogIndex
      } else {
        prevLogIndex = null
        prevLogTerm = null
      }
      
      lastIndexSent += entries.length
      
      logger.debug('leader sending >',
                   'term:', self._state.term(),
                   'leaderId:', self._state.id(),
                   'prevLogIndex:', prevLogIndex,
                   'prevLogTerm:', prevLogTerm,
                   'entries:', entries.length)
      
      node.nextIndex(lastIndexSent)
      node.appendEntries(self._state.term(),
                         self._state.id(),
                         prevLogIndex,
                         prevLogTerm,
                         entries,
                         self._state.commitIndex(),
                         function(err, response) {
        if(err) { throw err }
        
        if(response && response.term > self._state.term()) {
          logger.debug(self._state.id(), 'downgrading to follower')
          self._heartbeatLoop.stop()
        }
        
        if(response && response.ack) {
          logger.debug('ack', nextIndex, lastIndexSent)
          self._state.ackLog(commitTreshold, nextIndex, lastIndexSent)
          node.matchIndex(lastIndexSent)
        }
      })
    })
    callback()
  })

  this._electionTimeout = new Loopy({
    interval: randomElectionTimeout(),
    count: -1, // infinity
    onError: Loopy.OnError.IGNORE
  })

  this._electionTimeout.on('tick', function(callback) {
    logger.debug(self._state.id(), 'electionTimeout') 
    callback()
    self.becomeCandidate()
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
                                 callback)
        break
        
      default:
        callback(new Error('unsupported command'), undefined)
        break
        
    }
  })

  this._transport.start(function() {

    self._electionTimeout.start()

  })

  this._state.on('commit', function(commitIndex) {
    if(self._clientRequestsCallbacks.hasOwnProperty(commitIndex)) {
      var callback = self._clientRequestsCallbacks[commitIndex]
      delete self._clientRequestsCallbacks[commitIndex]
      callback()
    }
  })
}

Raft.prototype.addNode = function(node) {
  this._nodes.push(node)
}

Raft.prototype.append = function(log, callback) {
  if(!this.isLeader()) {
    throw new Error('Appending logs can only be done to the leader')
  }
  var index = this._state.appendLog(log)
  if(this._clientRequestsCallbacks.hasOwnProperty(index)) {
    throw new Error('A callback is already registered for this log index: ' + index)
  }
  // TODO: timeout
  this._clientRequestsCallbacks[index] = callback
}

Raft.prototype.becomeCandidate = function() {
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

  this._state.term(this._state.term() + 1)
    
  this._state.votedFor(this._state.id())
  var self = this
  this._electionTimeout.setInterval(randomElectionTimeout())
  this._electionTimeout.reset()
  var voteCount = 0
  var lastIndex = self._state.lastApplied()
  var lastLogEntry = this._state.getLogEntry(lastIndex)
  _.each(this._nodes, function(node) {
    node.requestVote(self._state.term(), 
                     self._state.id(),
                     lastIndex,
                     lastLogEntry ? lastLogEntry.term : 0,
                     function(err, response) {
      logger.debug(self._state.id(), 'receivedVote', voteCount, err, response)
      if(response && response.voteGranted) {
        voteCount ++
      }
      if(voteCount > (self._nodes.length / 2)) {
        logger.debug(self._state.id(), 'becoming leader')
        self._electionTimeout.stop()
        self._heartbeatLoop.start(/*now*/ true)
      }
    })
  })
}

Raft.prototype.start = function(callback) {
  this._transport.start(callback)
}

Raft.prototype.stop = function(callback) {
  this._transport.stop(callback)
}

Raft.prototype.isLeader = function() {
  return this._heartbeatLoop.status() === Loopy.Status.STARTED
}

function randomElectionTimeout() {
  return Math.floor(Math.random() * 150) + 150
}

module.exports = Raft
