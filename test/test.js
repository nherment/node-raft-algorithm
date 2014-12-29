var assert = require('assert')

var Raft = require('../Raft.js')
var Node = require('../lib/Node.js')
var InMemoryTransport = require('../lib/transports/InMemoryTransport.js')


describe('leader election', function() {
  // it('setup 3 nodes', function(done) {
  //   var server1 = new Raft(new InMemoryTransport())
  //   var server2 = new Raft(new InMemoryTransport())
  //   var server3 = new Raft(new InMemoryTransport())

  //   server1.addNode(new Node(server2._transport))
  //   server1.addNode(new Node(server3._transport))

  //   server2.addNode(new Node(server1._transport))
  //   server2.addNode(new Node(server3._transport))

  //   server3.addNode(new Node(server1._transport))
  //   server3.addNode(new Node(server2._transport))

  //   setTimeout(function() {
  //     var leaderCount = 0
  //     if(server1.isLeader()) {
  //       leaderCount++
  //     }
  //     if(server2.isLeader()) {
  //       leaderCount++
  //     }
  //     if(server3.isLeader()) {
  //       leaderCount++
  //     }

  //     assert.equal(leaderCount, 1)
  //     done()
  //   }, 500)
          
  // })
  
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

    setTimeout(function() {
      var leader
        
      if(server1.isLeader()) {
        leader = server1
      } else if(server2.isLeader()) {
        leader = server2
      } else if(server3.isLeader()) {
        leader = server3
      }

      assert.ok(leader)

      leader.append(1, function(err) {
        done()
      })
        
    }, 500)
          
  })
})
