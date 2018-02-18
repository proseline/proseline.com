var Duplexify = require('duplexify')
var assert = require('assert')
var flushWriteStream = require('flush-write-stream')
var inherits = require('util').inherits
var lengthPrefixedStream = require('length-prefixed-stream')
var parseJSON = require('json-parse-errback')
var protocolBuffers = require('protocol-buffers')
var pumpify = require('pumpify')
var random = require('../crypto/random')
var sodium = require('sodium-javascript')
var through2 = require('through2')

module.exports = Protocol

var VERSION = 1
var NONCE_LENGTH = 24

function Protocol (secretKey) {
  if (!(this instanceof Protocol)) return new Protocol()

  assert.equal(typeof secretKey, 'string')

  var self = this
  self._secretKeyBuffer = Buffer.from(secretKey, 'hex')

  // Cryptographic stream using our nonce and the secret key.
  self._nonce = random(NONCE_LENGTH)
  self._outboundCryptoStream = sodium.crypto_stream_xor_instance(
    self._nonce, self._secretKeyBuffer
  )
  self._encoder = pumpify(
    lengthPrefixedStream.encode(),
    through2(function (chunk, encoding, done) {
      if (self._sentNonce) {
        self._outboundCryptoStream.update(chunk, chunk)
      }
      done(null, chunk)
    })
  )
  // Cryptographic stream using our peer's nonce, which we've yet
  // to receive, and the secret key.
  self._peerNonce = null
  self._inboundCryptoStream = null
  self._decoder = lengthPrefixedStream.decode()
  self._decoder
    .pipe(flushWriteStream(function (chunk, _, done) {
      self._decode(chunk, done)
    }))
    .once('error', function (error) {
      self.destroy(error)
    })
  Duplexify.call(self, self._decoder, self._encoder)
}

inherits(Protocol, Duplexify)

var messages = protocolBuffers(`
message Handshake {
  required uint32 version = 1;
  // Nonce for encryption of subsequent messages using
  // the secret key.
  required bytes nonce = 2;
}

// This message serves two purposes, depending on
// message type prefix:
// 1. to offer log entries to our peer
// 2. to request log entries from our peer
message Log {
  required string publicKey = 1;
  required uint32 index = 2;
}

// Log Entry Envelopes
message Envelope {
  required string publicKey = 1;
  required string signature = 2;
  // JSON-encoded entry Object
  required string entry = 3;
}
`)

// Message Type Prefixes
var HANDSHAKE = 0
var OFFER = 1
var REQUEST = 2
var ENVELOPE = 3

Protocol.prototype.handshake = function (callback) {
  var self = this
  if (self._sentNonce) return callback()
  self._encode(HANDSHAKE, messages.Handshake, {
    version: VERSION,
    nonce: this._nonce
  }, function (error) {
    if (error) return callback(error)
    self._sentNonce = true
    callback()
  })
}

Protocol.prototype.offer = function (offer, callback) {
  this._encode(OFFER, messages.Log, offer, callback)
}

Protocol.prototype.request = function (request, callback) {
  this._encode(REQUEST, messages.Log, request, callback)
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
    self._outboundCryptoStream.final()
    self._outboundCryptoStream = null
    self._inboundCryptoStream.final()
    self._inboundCryptoStream = null
  })
}

Protocol.prototype._encode = function (prefix, encoding, data, callback) {
  // Create and write [prefix, bytes...].
  var buffer = Buffer.alloc(encoding.encodingLength(data) + 1)
  buffer[0] = prefix
  encoding.encode(data, buffer, 1)
  this._encoder.write(buffer, callback)
}

Protocol.prototype._decode = function (data, callback) {
  // Once given a nonce, decrypt messages.
  if (this._inboundCryptoStream) {
    this._inboundCryptoStream.update(data, data)
  }
  try {
    var message = decodeMessage(data)
  } catch (error) {
    return callback(error)
  }
  var prefix = data[0]
  if (prefix === HANDSHAKE) {
    var acceptableHandshake = (
      message.nonce.byteLength === NONCE_LENGTH &&
      message.version === VERSION
    )
    if (!this._peerNonce && acceptableHandshake) {
      this._peerNonce = message.nonce
      this._inboundCryptoStream = sodium.crypto_stream_xor_instance(
        this._peerNonce, this._secretKeyBuffer
      )
      this.emit('handshake', message, callback) || callback()
    }
  } else if (prefix === OFFER) {
    this.emit('offer', message, callback) || callback()
  } else if (prefix === REQUEST) {
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
  } else if (type === OFFER || type === REQUEST) {
    return messages.Log.decode(data, 1)
  } else if (type === ENVELOPE) {
    return messages.Envelope.decode(data, 1)
  } else {
    return null
  }
}
