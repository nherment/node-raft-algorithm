

function ClientTransport() {
}

ClientTransport.prototype.send = function(data, callback) {
  this._send(data, callback)
}


module.exports = ClientTransport
