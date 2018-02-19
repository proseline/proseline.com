var Duplexify = require('duplexify')
var assert = require('assert')
var flushWriteStream = require('flush-write-stream')
var inherits = require('util').inherits
var lengthPrefixedStream = require('length-prefixed-stream')
var parseJSON = require('json-parse-errback')
var pumpify = require('pumpify')
var random = require('../crypto/random')
var sodium = require('sodium-javascript')
var through2 = require('through2')
var validEnvelope = require('../schemas/validate').envelope
var validHandshake = require('./schemas/validate').handshake
var validLog = require('./schemas/validate').log
var validMessage = require('./schemas/validate').message

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

// Message Type Prefixes
var HANDSHAKE = 0
var OFFER = 1
var REQUEST = 2
var ENVELOPE = 3

Protocol.prototype.handshake = function (callback) {
  var self = this
  if (self._sentNonce) return callback()
  self._encode(HANDSHAKE, {
    version: VERSION,
    nonce: this._nonce.toString('hex')
  }, function (error) {
    if (error) return callback(error)
    self._sentNonce = true
    callback()
  })
}

Protocol.prototype.offer = function (offer, callback) {
  assert(validLog(offer))
  this._encode(OFFER, offer, callback)
}

Protocol.prototype.request = function (request, callback) {
  assert(validLog(request))
  this._encode(REQUEST, request, callback)
}

Protocol.prototype.envelope = function (envelope, callback) {
  assert(validEnvelope(envelope))
  this._encode(ENVELOPE, {
    publicKey: envelope.publicKey,
    signature: envelope.signature,
    entry: JSON.stringify(envelope.entry)
  }, callback)
}

Protocol.prototype.finalize = function (callback) {
  assert(typeof callback === 'function')
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

Protocol.prototype._encode = function (prefix, data, callback) {
  var buffer = Buffer.from(JSON.stringify([prefix, data]))
  this._encoder.write(buffer, callback)
}

Protocol.prototype._decode = function (message, callback) {
  // Once given a nonce, decrypt messages.
  if (this._inboundCryptoStream) {
    this._inboundCryptoStream.update(message, message)
  }
  try {
    var parsed = JSON.parse(message)
  } catch (error) {
    return callback(error)
  }
  if (!validMessage(parsed)) {
    return callback(new Error('invalid message'))
  }
  var prefix = parsed[0]
  var payload = parsed[1]
  if (prefix === HANDSHAKE && validHandshake(payload)) {
    if (!this._peerNonce) {
      this._peerNonce = Buffer.from(payload.nonce, 'hex')
      this._inboundCryptoStream = sodium.crypto_stream_xor_instance(
        this._peerNonce, this._secretKeyBuffer
      )
      this.emit('handshake', payload, callback) || callback()
    }
  } else if (prefix === OFFER && validLog(payload)) {
    this.emit('offer', payload, callback) || callback()
  } else if (prefix === REQUEST && validLog(payload)) {
    this.emit('request', payload, callback) || callback()
  } else if (prefix === ENVELOPE && validEnvelope(payload)) {
    parseJSON(payload.entry, function (error, entry) {
      if (error) return callback(error)
      payload.entry = entry
      this.emit('envelope', payload, callback) || callback()
    })
  } else {
    callback()
  }
}
