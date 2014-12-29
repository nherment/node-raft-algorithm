var assert = require('assert')

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
  
  
  it('setup 3 nodes, append log', function(done) {
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
                ' and cannot be set to ' + this.id())
      leader = this

      assert.ok(leader)

      leader.append(1, function(err) {
        done()
      })
        
    }
          
  })
})
