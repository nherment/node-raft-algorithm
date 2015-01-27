
This lib is work in progress and barely usable yet. Quality contributions are
welcome.

RAFT
====

Raft is a consensus algorithm like Plaxo but working with a master-slave scheme.
See an abstract [here](docs/raft.pdf) and an analysis
[here](docs/Analysis_of_Raft_Consensus.pdf)

What is this module ?
=====================

This library mainly implements the consensus algorithm and an API to interact
with it. It is fully implemented around the concept of API. It means that you
can use only the part(s) of the implementation that you want and customize:

- the transport mechanism. (Direct TCP by default and auto discovery over a local network).
- the log algorithm (by default, an in memory Map is provided, with basic Map
    manipulation functionality.
- the log compaction algorithm (snapshot)
- the log and snapshot persistance layer and algorithm (

- a default log compaction algorithm
- a default, configuable persistance 

Using this library implies you understand RAFT.

Currently supported
-------------------

- leader auto election
- split votes
- logs

Not supported yet
-----------------

- log compaction / snapshotting (Raft #7)
- client message id (needed for replay prevention on leader crash, Raft #8)
- leader no-op commit on leader election (Leader Completeness Property, Raft #8)
- majority heartbeat on read (Leader Completeness Property, Raft #8)


API and usage
=============

Quick start
-----------

```
var Raft = require('raft-algorithm')



// these are the default options
var defaultOptions = {
  autoDiscovery: 'auto',
  heartbeat: 20, // heartbeat in milliseconds
  minElectionTimeout: 150,
  minElectionTimeout: 300
}

var raft = new Raft(options)

raft.append({
  cmd: 'set',
  key: 'foobar',
  value: Date.now()
})

raft.start(function() {
  // to cleanly stop that instance, call the following
  // raft.stop(function() {})
})

raft.on('leader', function() {
  // that instance became the leader
})

```



Log Functionality
=================

By default, and because a choice had to be made for this library to be usable out
of the box, it provides a distributed Map functionality. A similar tool would be
Redis or Memcache.

Logs are Javascript objects with a command, a key and an optional value.

For example:

```
{
  cmd   : 'set',
  key   : 'abc',
  value : 1
}
```

The key must be a string. The value can be any JSON serializable javascript
object.

### Commands

- ``set``: sets the value for a given key
- ``get``: returns the value for a given key
- ``inc``: increments the value of a given key (default increment is ``1``)
- ``dec``: decrements the value of a given key (default decrement is ``1``)