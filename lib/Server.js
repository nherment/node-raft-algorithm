
var _ = require('lodash')
var logger = require('./Logger.js')
  
function Server(state) {
  this._state = state
}

/**
 * Invoked by leader to replicate log entries (§5.3); also used as heartbeat
 * (§5.2).
 *
 * @param term          leader’s term
 * @param leaderId      so follower can redirect clients
 * @param prevLogIndex 	index of log entry immediately preceding new ones
 * @param prevLogTerm   term of prevLogIndex entry
 * @param entries[]     log entries to store (empty for heartbeat; may send more
 *                      than one for efficiency)
 * @param leaderCommit 	leader’s commitIndex
 *
 * @callback term       currentTerm, for leader to update itself
 * @callback ack        true if follower contained entry matching prevLogIndex
 *                      and prevLogTerm
 *
 */
Server.prototype.appendEntries = function(term,
                                          leaderId,
                                          prevLogIndex,
                                          prevLogTerm,
                                          entries,
                                          leaderCommit,
                                          callback) {

  // Receiver implementation:
  // 1. Reply false if term < currentTerm (§5.1)
  // 2. Reply false if log doesn’t contain an entry at prevLogIndex
  // whose term matches prevLogTerm (§5.3)

  // TODO:
  // 3. If an existing entry conflicts with a new one (same index
  // 	but different terms), delete the existing entry and all that
  // 	follow it (§5.3)
  // 	4. Append any new entries not already in the log
  // 	5. If leaderCommit > commitIndex, set commitIndex =
  // 	min(leaderCommit, index of last new entry)
  var self = this
  var ack = false
  if(term < this._state.term()) {
    logger.info('appendEntries denied because the term is lower than required')
    ack = false
  } else if(!this._matchTerm(prevLogIndex, prevLogTerm)) {
    logger.info('appendEntries denied because there is no log entry with the right term', prevLogIndex, prevLogTerm)
    ack = false
  } else {
    ack = true
    this._state.appendRawLogs(entries)
    if(leaderCommit > this._state.commitIndex()) {
      this._state.commitIndex(Math.min(leaderCommit, this._state.lastApplied()))
    }
  }
  logger.debug('ACK', ack, term, this._state.term(), prevLogIndex, prevLogTerm)
  
  callback(undefined, {
    term: this._state.term(),
    ack: ack,
    id: this._state.id()
  })
}

/**
 * returns false if log doesn’t contain an entry at prevLogIndex
 * whose term matches prevLogTerm (§5.3)
 */
Server.prototype._matchTerm = function(index, term) {
  
  var log = this._state.getLogEntry(index)
  if(log) {
    return log.term === term
  } else if(index === null && term === null) {
    return true // this is a ping
  } else {
    return false
  }

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
Server.prototype.requestVote = function(term,
                                        candidateId,
                                        lastLogIndex,
                                        lastLogTerm,
                                        callback) {
  // Receiver implementation:
  // 1. Reply false if term < currentTerm (§5.1)
  // 2. If votedFor is null or candidateId, and candidate’s log is at
  // least as up-to-date as receiver’s log, grant vote (§5.2, §5.4)
  if(term < this._state.term()) {
    voteGranted = false
  } else if(!this._state.votedFor() && lastLogTerm >= this._state.lastApplied()) {
    voteGranted = true
    this._state.votedFor(candidateId)
  }
  callback(undefined, {
    term: this._state.term(),
    voteGranted: voteGranted,
    id: this._state.id()
  })
}

/**
 * Invoked by leader to send chunks of a snapshot to a follower. Leaders always
 * send chunks in order.
 *
 * @param term leader’s term
 * @param leaderId so follower can redirect clients
 * @param lastIncludedIndex the snapshot replaces all entries up through and 
 *                          including this index
 * @param lastIncludedTerm term of lastIncludedIndex
 * @param offset byte offset where chunk is positioned in the snapshot file
 * @param data[] raw bytes of the snapshot chunk, starting at offset
 * @param done true if this is the last chunk Results:
 * @callback term currentTerm, for leader to update itself
 */
Server.prototype.installSnapshot = function(term, leaderId, callback) {

  // Receiver implementation:
  // 1. Reply immediately if term < currentTerm
  // 2. Create new snapshot file if first chunk (offset is 0)
  // 3. Write data into snapshot file at given offset
  // 4. Reply and wait for more data chunks if done is false
  // 5. Save snapshot file, discard any existing or partial snapshot
  // with a smaller index
  // 6. If existing log entry has same index and term as snapshot’s
  // last included entry, retain log entries following it and reply
  // 7. Discard the entire log
  // 8. Reset state machine using snapshot contents (and load
  // 	snapshot’s cluster configuration)
  //
}

// Rules
//
// All Servers:
// - If commitIndex > lastApplied: increment lastApplied, apply log[lastApplied] to
//   state machine (§5.3)
// - If RPC request or response contains term T > currentTerm: set currentTerm = T,
//   convert to follower (§5.1)
//
// Followers (§5.2):
// - Respond to RPCs from candidates and leaders
// - If election timeout elapses without receiving AppendEntries RPC from current
//   leader or granting vote to candidate: convert to candidate
//
// Candidates (§5.2):
// - On conversion to candidate, start election:
// 	- Increment currentTerm
// 	- Vote for self
// 	- Reset election timer
// 	- Send RequestVote RPCs to all other servers
// - If votes received from majority of servers: become leader
// - If AppendEntries RPC received from new leader: convert to
// follower
// - If election timeout elapses: start new election
//
// Leaders:
// - Upon election: send initial empty AppendEntries RPCs (heartbeat) to each
//   server; repeat during idle periods to prevent election timeouts (§5.2)
// - If command received from client: append entry to local log, respond after
//   entry applied to state machine (§5.3)
// - If last log index ≥ nextIndex for a follower: send AppendEntries RPC with log
//   entries starting at nextIndex
//   - If successful: update nextIndex and matchIndex for
//     follower (§5.3)
//   - If AppendEntries fails because of log inconsistency:
// decrement nextIndex and retry (§5.3)
// - If there exists an N such that N > commitIndex, a majority of
//   matchIndex[i] ≥ N, and log[N].term == currentTerm: set commitIndex = N (§5.3,
// 	§5.4).

module.exports = Server
