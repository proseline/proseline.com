var Duplexify = require('duplexify')
var assert = require('assert')
var debug = require('debug')('proseline:protocol')
var inherits = require('util').inherits
var lengthPrefixedStream = require('length-prefixed-stream')
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
  if (!(this instanceof Protocol)) return new Protocol(secretKey)

  assert.equal(typeof secretKey, 'string')

  var self = this
  self._secretKeyBuffer = Buffer.from(secretKey, 'hex')

  // Readable: messages to our peer

  // Cryptographic stream using our nonce and the secret key.
  self._sendingNonce = Buffer.alloc(NONCE_LENGTH)
  sodium.randombytes_buf(self._sendingNonce)
  debug('sending nonce: %o', self._sendingNonce.toString('hex'))
  self._sendingCipher = cipher(
    self._sendingNonce, self._secretKeyBuffer
  )
  self._encoder = lengthPrefixedStream.encode()
  self._readable = through2.obj(function (chunk, _, done) {
    assert(Buffer.isBuffer(chunk))
    // Once we've sent our nonce, encrypt.
    if (self._sentNonce) {
      self._sendingCipher.update(chunk, chunk)
    }
    this.push(chunk)
    done()
  })
  self._encoder
    .pipe(self._readable)
    .once('error', function (error) {
      self.destroy(error)
    })

  // Writable: messages from our peer

  // Cryptographic stream using our peer's nonce, which we've yet
  // to receive, and the secret key.
  self._receivingNonce = null
  self._receivingCipher = null
  self._writable = through2(function (chunk, encoding, done) {
    assert(Buffer.isBuffer(chunk))
    // Once given a nonce, decrypt.
    if (self._receivingCipher) {
      self._receivingCipher.update(chunk, chunk)
    }
    done(null, chunk)
  })
  self._parser = through2.obj(function (chunk, _, done) {
    self._parse(chunk, function (error) {
      if (error) return done(error)
      done()
    })
  })
  self._writable
    .pipe(lengthPrefixedStream.decode())
    .pipe(self._parser)
    .once('error', function (error) {
      self.destroy(error)
    })

  Duplexify.call(self, self._writable, self._readable)
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
  debug('sending handshake')
  self._encode(HANDSHAKE, {
    version: VERSION,
    nonce: this._sendingNonce.toString('hex')
  }, function (error) {
    if (error) return callback(error)
    self._sentNonce = true
    callback()
  })
}

Protocol.prototype.offer = function (offer, callback) {
  assert(validLog(offer))
  debug('offering: %o', offer)
  this._encode(OFFER, offer, callback)
}

Protocol.prototype.request = function (request, callback) {
  assert(validLog(request))
  debug('requesting: %o', request)
  this._encode(REQUEST, request, callback)
}

Protocol.prototype.envelope = function (envelope, callback) {
  assert(validEnvelope(envelope))
  debug('sending envelope: %o', envelope)
  this._encode(ENVELOPE, envelope, callback)
}

Protocol.prototype.finalize = function (callback) {
  assert(typeof callback === 'function')
  var self = this
  self._finalize(function (error) {
    if (error) return self.destroy(error)
    self._encoder.end(callback)
    self._sendingCipher.final()
    self._sendingCipher = null
    self._receivingCipher.final()
    self._receivingCipher = null
  })
}

Protocol.prototype._encode = function (prefix, data, callback) {
  var buffer = Buffer.from(JSON.stringify([prefix, data]), 'utf8')
  this._encoder.write(buffer, callback)
}

Protocol.prototype._parse = function (message, callback) {
  try {
    var parsed = JSON.parse(message)
  } catch (error) {
    return callback(error)
  }
  debug('parsed: %o', parsed)
  if (!validMessage(parsed)) {
    debug('invalid message')
    return callback(new Error('invalid message'))
  }
  var prefix = parsed[0]
  var body = parsed[1]
  if (prefix === HANDSHAKE && validHandshake(body)) {
    if (!this._receivingCipher) {
      debug('peer nonce: %o', body.nonce)
      this._receivingNonce = Buffer.from(body.nonce, 'hex')
      assert.equal(this._receivingNonce.byteLength, NONCE_LENGTH)
      this._receivingCipher = cipher(
        this._receivingNonce, this._secretKeyBuffer
      )
      this.emit('handshake', callback) || callback()
    } else {
      callback()
    }
  } else if (prefix === OFFER && validLog(body)) {
    this.emit('offer', body, callback) || callback()
  } else if (prefix === REQUEST && validLog(body)) {
    this.emit('request', body, callback) || callback()
  } else if (prefix === ENVELOPE && validEnvelope(body)) {
    this.emit('envelope', body, callback) || callback()
  } else {
    debug('invalid message')
    callback()
  }
}

function cipher (nonce, secretKeyBuffer) {
  assert(Buffer.isBuffer(nonce))
  assert(nonce.byteLength, NONCE_LENGTH)
  assert(Buffer.isBuffer(secretKeyBuffer))
  return sodium.crypto_stream_xor_instance(
    nonce, secretKeyBuffer
  )
}
