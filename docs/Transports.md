
Transports
==========

This module does provide basic transports but mostly provides shells to
implement your own transports.

Implementating your transport
-----------------------------

There are 2 types of transports. A server (usually exposing the follower API)
and a client (usually the leader). These transports are exclusively for the
internal use of the library and should not be shared with the process using
the library.

The role of the transports is purely to transfer a serializable payload from
a client to a server and vice versa. This can typically be done with JSON but
you are not restricted.

The steps involving transports are as follow:
 
1- Raft calls the client transport with a serializable javascript object
2- The ClientTransport connects to the remote server.
3- The ClientTransport then serializes that object and sends it to a
   the remote ServerTranport over the wire
3- The ServerTransport receives a payload, deserializes it and emits a
   ``data`` event as sent by the client and wait for Raft to respond to
   that ``data`` event.
4- Raft process that data event and pass a response to the ServerTransport.
   That response is a serializable javascript object.
5- The ServerTransport serializes the response and sends it to the client.
6- The client deserializes the response and passes it over to Raft

### ClientTransport


```
  ClientTransport.prototype._shutdown = function(callback) {
    ...
  }
  
  ClientTransport.prototype._send = function(data, callback) {
    ...
    callback(err, response)  
  }
```

Where:
- ``data`` is a javascript object to send to a server
- ``callback`` is expected to carry 2 arguments:
  - ``err`` when an error happened
  - ``response`` the serializable data as sent by the server


### ServerTransport

The first step is to inherit the ServerTransport prototype.

```
var ServerTransport = require('raft-algorithm').ServerTransport

function MyTransport() {
  ServerTransport.call(this)
}

util.inherits(MyTransport, ServerTransport)
```

#### Methods

There are 2 methods to implement

##### ``Transport.prototype._start(callback)``

Invoked when the node is initialized.

You will want to start your server in that function.

##### ``Transport.prototype._stop(callback)``

Invoked when the node is being shut down.

##### ``Transport.prototype._send(remote, data, callback)``

Invoked when data needs to be sent.

#### Events

The ServerTransport communicates incomming messages to Raft by emmiting events.

Here is a partial example for an express.js implementation:
```
   ...
   Server.prototype.handleRequest(req, res, next) {
     this.emit('data', req.body, function(err, response) {
       if(err) {
         res.status(500).send(err)
       } else {
         res.status(200).send(response)
       }
     })
   }
   ...
```