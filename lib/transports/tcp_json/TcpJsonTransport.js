
var net = require('net')
var objectstream = require('objectstream')

function ClientTransport(remoteHost, remotePort) {
  this._host = remoteHost
  this._port = remotePort
  this._nextId = 0

  this._callbackMap = {}
}

ClientTransport.prototype._nextId = function() {
  return this._nextId ++
}

ClientTransport.prototype._getStream = function(callback) {
  var self = this
  if(this._writableStream && this._readableStream) {
    setImmediate(function() {
      callback(self._stream)
    })
  } else {
    var client = new net.Socket()
    client.connect(self._port, self._host, function() {
      console.log('Connected')
      self._client = client

      self._stream = objectstream.createStream(client)
      self._stream.on('data', function(responseWrapper) {
        if(self._callbackMap.hasOwnProperty(responseWrapper.id)) {
          self._callbackMap[responseWrapper.id](responseWrapper.err, responseWrapper.data)
          delete self._callbackMap[responseWrapper.id]
        } else {
          console.error('non binded response', JSON.stringify(responseWrapper))
        }
      })

      client.on('end', function () {
        // TODO: remove all listeners
        self._client = null
        self._stream = null
      })
    })
  }
}

ClientTransport.prototype._shutdown = function(callback) {
  if(this._client) {
    this._client.destroy()
    this._client = null
  }
}
  
ClientTransport.prototype._send = function(data, callback) {
  var wrappedData = {
    id:   this._nextId()
    data: data
  }
  this._callbacksMap[wrapperwrappedData.id] = callback
  this._getStream(function(stream) {
    stream.write(wrappedData)
  })
}

function ServerTransport( bindAddress, port) {
  var self = this 
  this._bindAddress = bindAddress
  this._port = port
  
  this._server = net.createServer(function(socket) {
    var stream = objectstream.createStream(socket)

    stream.on('data', function(wrapper) {
      self.emit('data', wrapper.data, function(err, response) {
        wrapper.err = err
        wrapper.data = response
        stream.write(wrapper)
      })
    })
  })  
}
    
ServerTransport.prototype._start = function(callback) {
  this._server.listen(this._port, '127.0.0.1', callback)
}

ServerTransport.prototype._stop = function(callback) {
  this._server.close(callback)
}

module.exports = {
  ClientTransport: ClientTransport,
  ServerTransport: ServerTransport
}
