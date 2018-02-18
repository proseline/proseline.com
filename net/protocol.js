var Duplexify = require('duplexify')
var assert = require('assert')
var inherits = require('util').inherits
var lengthPrefixedStream = require('length-prefixed-stream')
var parseJSON = require('json-parse-errback')
var protocolBuffers = require('protocol-buffers')
var pumpify = require('pumpify')
var sodium = require('sodium-javascript')
var through2 = require('through2')

module.exports = Protocol

function Protocol (options) {
  if (!(this instanceof Protocol)) return new Protocol()

  assert.equal(typeof options.secretKey, 'string')
  assert(Buffer.isbuffer(options.nonce))
  assert.equal(options.nonce.byteLength, 24)
  assert(Buffer.isbuffer(options.peerNonce))
  assert.equal(options.peerNonce.byteLength, 24)
  var secretKey = options.secretKey
  var nonce = options.nonce
  var peerNonce = options.peerNonce

  var self = this
  self._secretKeyBuffer = Buffer.from(secretKey, 'hex')
  self._nonce = nonce
  self._peerNonce = peerNonce
  // Create XOR streams to encrypt messages.
  self._crypto = sodium.crypto_stream_xor_instance(
    self._nonce, self._secretKeyBuffer
  )
  self._peerCrypto = sodium.crypto_stream_xor_instance(
    self._peerNonce, self._secretKeyBuffer
  )
  self._encoder = pumpify(
    // Prefix our messages with their length.
    lengthPrefixedStream.encode(),
    // Encrypt our length-prefixed messages.
    through2(function (chunk, _, done) {
      self._crypto.update(chunk, chunk)
      done(null, chunk)
    })
  )
  self._decoder = lengthPrefixedStream.decode()
  self._decoder.pipe(
    through2.obj(function (data, encoding, callback) {
      self._peerCrypto.update(data, data)
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
// Log Entries
message Envelope {
  required string publicKey = 1;
  required string signature = 2;
  required string entry = 3;
}

// Dual Purpose:
// 1. offer log entries
// 2. request log entries
message Log {
  required string publicKey = 1;
  required uint32 index = 2;
}

message Handshake {
  required uint32 version = 1;
}
`)

// Message Type Prefixes
var HANDSHAKE = 0
var OFFER_LOG = 1
var REQUEST_LOG = 2
var ENVELOPE = 3

Protocol.prototype.handshake = function (handshake, callback) {
  this._encode(HANDSHAKE, messages.Handshake, handshake, callback)
}

Protocol.prototype.offer = function (offer, callback) {
  this._encode(OFFER_LOG, messages.Log, offer, callback)
}

Protocol.prototype.request = function (request, callback) {
  this._encode(REQUEST_LOG, messages.Log, request, callback)
}

Protocol.prototype.envelope = function (envelope, callback) {
  this._encode(ENVELOPE, messages.Envelope, {
    publicKey: envelope.publicKey,
    signature: envelope.signature,
    entry: JSON.stringify(envelope.entry)
  }, callback)
}

Protocol.prototype.finalize = function (callback) {
  var self = this
  self._finalize(function (error) {
    if (error) return self.destroy(error)
    self._encoder.end(callback)
    self._crypto.final()
    self._crypto = null
    self._peerCrypto.final()
    self._peerCrypto = null
  })
}

Protocol.prototype._encode = function (prefix, encoding, data, callback) {
  var buffer = Buffer.alloc(encoding.encodingLength(data) + 1)
  buffer[0] = prefix
  encoding.encode(data, buffer, 1)
  this._encoder.write(buffer, callback)
}

Protocol.prototype._decode = function (data, callback) {
  try {
    var message = decodeMessage(data)
  } catch (error) {
    return callback(error)
  }
  var prefix = data[0]
  if (prefix === HANDSHAKE) {
    this.emit('handshake', message, callback) || callback()
  } else if (prefix === OFFER_LOG) {
    this.emit('offer', message, callback) || callback()
  } else if (prefix === REQUEST_LOG) {
    this.emit('request', message, callback) || callback()
  } else if (prefix === ENVELOPE) {
    parseJSON(message.entry, function (error, entry) {
      if (error) return callback(error)
      message.entry = entry
      this.emit('envelope', message, callback) || callback()
    })
  } else {
    callback()
  }
}

function decodeMessage (data) {
  var type = data[0]
  if (type === HANDSHAKE) {
    return messages.Handshake.decode(data, 1)
  } else if (type === OFFER_LOG || type === REQUEST_LOG) {
    return messages.Log.decode(data, 1)
  } else if (type === ENVELOPE) {
    return messages.Envelope.decode(data, 1)
  } else {
    return null
  }
}
