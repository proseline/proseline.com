var Duplexify = require('duplexify')
var inherits = require('util').inherits
var lengthPrefixedStream = require('length-prefixed-stream')
var protocolBuffers = require('protocol-buffers')
var through2 = require('through2')

module.exports = Protocol

function Protocol () {
  if (!(this instanceof Protocol)) return new Protocol()
  var self = this
  self._encoder = lengthPrefixedStream.encode()
  self._decoder = lengthPrefixedStream.decode()
  self._decoder.pipe(
    through2.obj(function (data, encoding, callback) {
      self._decode(data, callback)
    })
      .on('error', function (error) {
        self.destroy(error)
      })
  )
  Duplexify.call(self, self._decoder, self._encoder)
}

inherits(Protocol, Duplexify)

var messages = protocolBuffers(`
message Node {
  required string publicKey = 1;
  required string signature = 2;
  required string entry = 3;
}

message Log {
  required string publicKey = 1;
  required uint32 head = 2;
}

message Handshake {
  required uint32 version = 1;
}
`)

messages.Empty = {
  encodingLength: function () { return 0 },
  encode: function (data, buffer, offset) { return buffer }
}

Protocol.prototype.handshake = function (handshake, callback) {
  this._encode(0, messages.Handshake, handshake, callback)
}

Protocol.prototype.have = function (have, callback) {
  this._encode(1, messages.Log, have, callback)
}

Protocol.prototype.want = function (want, callback) {
  this._encode(2, messages.Log, want, callback)
}

Protocol.prototype.node = function (node, callback) {
  this._encode(3, messages.Node, node, callback)
}

Protocol.prototype.sentHeads = function (callback) {
  this._encode(4, messages.Empty, null, callback)
}

Protocol.prototype.sentWants = function (callback) {
  this._encode(5, messages.Empty, null, callback)
}

Protocol.prototype.finalize = function (callback) {
  var self = this
  self._finalize(function (error) {
    if (error) return self.destroy(error)
    self._encoder.end(callback)
  })
}

Protocol.prototype._encode = function (type, encoding, data, callback) {
  var buffer = Buffer.alloc(encoding.encodingLength(data) + 1)
  buffer[0] = type
  encoding.encode(data, buffer, 1)
  this._encoder.write(buffer, callback)
}

Protocol.prototype._decode = function (data, callback) {
  try {
    var message = decodeMessage(data)
  } catch (error) {
    return callback(error)
  }
  var type = data[0]
  if (type === 0) {
    this.emit('handshake', message, callback) || callback()
  } else if (type === 1) {
    this.emit('have', message, callback) || callback()
  } else if (type === 2) {
    this.emit('want', message, callback) || callback()
  } else if (type === 3) {
    this.emit('node', message, callback) || callback()
  } else if (type === 4) {
    this.emit('sentHeads', callback) || callback()
  } else if (type === 5) {
    this.emit('sentWants', callback) || callback()
  } else {
    callback()
  }
}

function decodeMessage (data) {
  var type = data[0]
  if (type === 0) return messages.Handshake.decode(data, 1)
  else if (type === 1 || type === 2) return messages.Log.decode(data, 1)
  else if (type === 3) return messages.Node.decode(data, 1)
  else return null
}
