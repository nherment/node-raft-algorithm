var assert = require('assert')
var _ = require('lodash')

var Raft = require('../Raft.js')
var Node = require('../lib/Node.js')
var InMemoryTransport = require('../lib/transports/InMemoryTransport.js')


describe('leader election', function() {
  it('setup 3 nodes', function(done) {
    var server1 = new Raft(new InMemoryTransport())
    var server2 = new Raft(new InMemoryTransport())
    var server3 = new Raft(new InMemoryTransport())

    server1.addNode(new Node(server2._transport))
    server1.addNode(new Node(server3._transport))

    server2.addNode(new Node(server1._transport))
    server2.addNode(new Node(server3._transport))

    server3.addNode(new Node(server1._transport))
    server3.addNode(new Node(server2._transport))

    server1.start()
    server2.start()
    server3.start()
      
    setTimeout(function() {
      var leaderCount = 0
      if(server1.isLeader()) {
        leaderCount++
      }
      if(server2.isLeader()) {
        leaderCount++
      }
      if(server3.isLeader()) {
        leaderCount++
      }

      assert.equal(leaderCount, 1)
      done()
    }, 500)
          
  })

  it('setup 3 nodes with an initial split vote', function(done) {
    
    function fixedElectionTimeout() {
      return 150;
    }

    var originalElectionTimeout = Raft.prototype._randomElectionTimeout
    Raft.prototype._randomElectionTimeout = fixedElectionTimeout
    var server1 = new Raft(new InMemoryTransport())
    var server2 = new Raft(new InMemoryTransport())
    var server3 = new Raft(new InMemoryTransport())
    
    server1.addNode(new Node(server2._transport))
    server1.addNode(new Node(server3._transport))

    server2.addNode(new Node(server1._transport))
    server2.addNode(new Node(server3._transport))

    server3.addNode(new Node(server1._transport))
    server3.addNode(new Node(server2._transport))

    server1.start()
    server2.start()
    server3.start()

    var electionStartTime = Date.now()
    
    // give the nodes enough time to start with the same timeout
    // and the first election will be a split vote
    setTimeout(function() {
      Raft.prototype._randomElectionTimeout = originalElectionTimeout
    }, server1.minElectionTimeout()) // use server1 as reference but could be any

    var leader = null
    
    server1.on('leader', assertSplitVoteHappened)
    server2.on('leader', assertSplitVoteHappened)
    server3.on('leader', assertSplitVoteHappened)
    
    function assertSplitVoteHappened () {
      var electionDelay = Date.now() - electionStartTime;
      // the max here is to make sure we don't have false positives.
      // Though we may have false negatives if maxTm > minTm and the
      //   re-election happens quickly.
      var expectedMinElectionDelayOnSplitVote = Math.max(2 * server1.minElectionTimeout(),
                                                         server1.maxElectionTimeout())
      assert.ok(electionDelay > expectedMinElectionDelayOnSplitVote,
                'A split vote did not happen. The leader election happened in ' +
                electionDelay + 'ms but it should be no faster than ' +
                expectedMinElectionDelayOnSplitVote)
      
      server1.stop()
      server2.stop()
      server3.stop()
      
      done()

    }

  })

  
  it('setup 3 nodes, leader goes down', function(done) {
    var server1 = new Raft(new InMemoryTransport())
    var server2 = new Raft(new InMemoryTransport())
    var server3 = new Raft(new InMemoryTransport())

    server1.addNode(new Node(server2._transport))
    server1.addNode(new Node(server3._transport))

    server2.addNode(new Node(server1._transport))
    server2.addNode(new Node(server3._transport))

    server3.addNode(new Node(server1._transport))
    server3.addNode(new Node(server2._transport))

    server1.start()
    server2.start()
    server3.start()
      
    var leader = null
    
    server1.on('leader', shutdownLeader)
    server2.on('leader', shutdownLeader)
    server3.on('leader', shutdownLeader)
    var reElection = false
    function shutdownLeader () {
      leader = this
      if(reElection) {
        server1.stop()
        server2.stop()
        server3.stop()
        done()
      } else {
        reElection = true
        leader.stop()
      }
        
    }
          
  })
  
  
  it('setup 3 nodes, append logs', function(done) {
    var server1 = new Raft(new InMemoryTransport())
    var server2 = new Raft(new InMemoryTransport())
    var server3 = new Raft(new InMemoryTransport())

    server1.addNode(new Node(server2._transport))
    server1.addNode(new Node(server3._transport))

    server2.addNode(new Node(server1._transport))
    server2.addNode(new Node(server3._transport))

    server3.addNode(new Node(server1._transport))
    server3.addNode(new Node(server2._transport))

    server1.start()
    server2.start()
    server3.start()
      
    var leader = null

    server1.on('leader', appendLog)
    server2.on('leader', appendLog)
    server3.on('leader', appendLog)
    
    function appendLog () {

      assert.ok(!leader, 'leader was already set to ' +
                         (leader ? leader.id() : null) +
                         ' and cannot be set to ' +
                         this.id())
      
      leader = this

      assert.ok(leader)

      leader.append(1, function(err) {
        assert.ok(!err, err)
        
        leader.append(2, function(err) {
          assert.ok(!err, err)
          
          leader.append(3, function(err) {
            assert.ok(!err, err)
            
            // at least another follower should have the logs
            var followerLogs
            if(server1 !== leader) {
              assert.ok(!server1.isLeader())
              followerLogs = server1.logs(0)
            }

            if(server2 !== leader) {
              assert.ok(!server2.isLeader())
              followerLogs = followerLogs || server2.logs(0)
            }

            if(server3 !== leader) {
              assert.ok(!server3.isLeader())
              followerLogs = followerLogs || server3.logs(0)
            }

            assert.ok(leader.logs())
            assert.equal(leader.logs().length, 3)

            for(var i = 0 ; i < leader.logs().length ; i++) {
              var leaderLogEntry = leader.logs()[i]
              var followerLogEntry = followerLogs[i]
              assert.ok(_.isEqual(leaderLogEntry, followerLogEntry))
            }
            done()
            
          })
        })
      })
        
    }
          
  })
})
