

function Node(clientTransport) {
  this._transport = clientTransport


  this._id = null
  //--------------------------------------------------------------------------//
  //--                        Volatile state on leaders                     --//
  //--------------------------------------------------------------------------//
  // (Reinitialized after election)

  this._nextIndex = 0

  this._matchIndex = 0
}

Node.prototype.id = function(id) {
  if(id !== undefined) {
    this._id = id  
  } else {
    return this._id
  }
}

/** index of the next log entry to send to that server
 * (initialized to leader last log index + 1)
 */
Node.prototype.nextIndex = function(nextIndex) {
  if(nextIndex !== undefined) {
    this._nextIndex = nextIndex
  } else {
    return this._nextIndex
  }
}

/** index of highest log entry known to be replicated on
 * server (initialized to 0, increases monotonically)
 */
Node.prototype.matchIndex = function(matchIndex) {
  if(matchIndex !== undefined) {
    this._matchIndex = matchIndex
  } else {
    return this._matchIndex
  }
}

Node.prototype._send = function(data, callback) {
  this._transport.send(data, callback)
}

/**
 * Invoked by leader to replicate log entries (§5.3); also used as heartbeat
 * (§5.2).
 *
 * @param term          leader's term
 * @param leaderId      so follower can redirect clients
 * @param prevLogIndex 	index of log entry immediately preceding new ones
 * @param prevLogTerm   term of prevLogIndex entry
 * @param entries[]     log entries to store (empty for heartbeat; may send more
 *                      than one for efficiency)
 * @param leaderCommit 	leader’s commitIndex
 *
 * @callback err, {ack, term}
 *                      - ack: true if follower contained entry matching
 *                        prevLogIndex and prevLogTerm
 *                      - term: currentTerm, for leader to update itself
 *
 */
Node.prototype.appendEntries = function(term,
                                        leaderId,
                                        prevLogIndex,
                                        prevLogTerm,
                                        entries,
                                        leaderCommit,
                                        callback) {
  this._send({
    cmd: 'appendEntries',
    term: term,
    leaderId: leaderId,
    prevLogIndex: prevLogIndex,
    prevLogTerm: prevLogTerm,
    entries: entries,
    leaderCommit: leaderCommit
  }, callback)
}

/**
 * Invoked by candidates to gather votes (§5.2).
 *
 * @param term 	        candidate’s term
 * @param candidateId   candidate requesting vote
 * @param lastLogIndex 	index of candidate’s last log entry (§5.4)
 * @param lastLogTerm 	term of candidate’s last log entry (§5.4)
 *
 * @return term         currentTerm, for candidate to update itself
 * @return voteGranted 	true means candidate received vote
 *
 *
 */
Node.prototype.requestVote = function(term,
                                      candidateId,
                                      lastLogIndex,
                                      lastLogTerm,
                                      callback) {
  this._send({
    cmd: 'requestVote',
    term: term,
    candidateId: candidateId,
    lastLogIndex: lastLogIndex,
    lastLogTerm: lastLogTerm,
  }, callback)
}

module.exports = Node
