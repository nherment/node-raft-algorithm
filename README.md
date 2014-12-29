
This lib is work in progress and not usable yet. Quality contributions are
welcome.

RAFT
====

Raft is a consensus algorithm simpler than Plaxo. See an abstract
[here](docs/raft.pdf).

What this is
============

This library mainly implements the consensus algorithm and an API to interact
with it. Additional to that, it provides:

- a default transport mechanism [thrift](https://thrift.apache.org/)
- a clean API to synchronize processes or servers

Using this library implies you understand RAFT.


Transport
=========

This module does not provide the transport but provides a shell to implement
your own transport.

Implementation
--------------

The first step is to inherit the transport prototype.

```
var Transport = require('raft-algorithm').Transport

function MyTransport() {
	Transport.call(this)
}

util.inherits(MyTransport, Transport)
```

### ``Transport.prototype._start(callback)``

Invoked when the node is initialized.

You will want to start your server in that function.

### ``Transport.prototype._stop(callback)``

Invoked when the node is being shut down.

### ``Transport.prototype._send(remote, data, callback)``

Invoked when data needs to be sent.
