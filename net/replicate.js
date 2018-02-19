var Protocol = require('./protocol')
var assert = require('assert')
var debug = require('debug')('proseline:replicate')
var flushWriteStream = require('flush-write-stream')
var hash = require('../crypto/hash')
var stringify = require('../utilities/stringify')
var validate = require('../schemas/validate')

module.exports = function (options) {
  assert.equal(typeof options.secretKey, 'string')
  assert.equal(typeof options.discoveryKey, 'string')
  assert(options.database)
  var secretKey = options.secretKey
  var discoveryKey = options.discoveryKey
  var database = options.database

  var protocol = new Protocol(secretKey)

  // Store a list of envelopes that we've requested, so we can
  // check the list to avoid offering this peer envelopes we've
  // just received from it.
  var requestedFromPeer = []

  // Stream log information from our database.
  var logsStream = database.createLogsStream()
  var updateStream = database.createUpdateStream()

  protocol.once('handshake', function () {
    // Offer currently known logs.
    logsStream
      .pipe(flushWriteStream.obj(function (chunk, _, done) {
        protocol.offer(chunk, done)
      }))
      .once('finish', function () {
        debug('finished offering preexisting')
        // Offer updates that come later.
        updateStream
          .pipe(flushWriteStream.obj(function (chunk, _, done) {
            var requestIndex = requestedFromPeer
              .findIndex(function (request) {
                return (
                  request.publicKey === chunk.publicKey &&
                  request.index === chunk.index
                )
              })
            if (requestIndex === -1) {
              protocol.offer(chunk, done)
            } else {
              requestedFromPeer.split(requestIndex, 1)
              done()
            }
          }))
      })
  })

  // When our peer requests an envelope...
  protocol.on('request', function (message, callback) {
    debug('request: %o', message)
    var publicKey = message.publicKey
    var index = message.index
    database.getEnvelope(publicKey, index, function (error, envelope) {
      if (error) return callback(error)
      if (envelope === undefined) return callback()
      debug('sending: %o', envelope)
      protocol.envelope(envelope, callback)
    })
  })

  // TODO: Prevent duplicate requests for the same envelope.

  // When our peer offers envelopes...
  protocol.on('offer', function (message, callback) {
    debug('offer: %o', message)
    var publicKey = message.publicKey
    var offeredIndex = message.index
    database.getLogHead(publicKey, function (error, head) {
      if (error) return callback(error)
      if (head !== undefined && head >= offeredIndex) return callback()
      var index = head ? (head + 1) : 0
      requestNextEnvelope()
      function requestNextEnvelope () {
        if (index > offeredIndex) return callback()
        debug('requesting: %o', message)
        protocol.request({publicKey, index}, function (error) {
          if (error) return callback(error)
          requestedFromPeer.push({publicKey, index})
          index++
          requestNextEnvelope()
        })
      }
    })
  })

  // When our peer sends an envelope...
  protocol.on('envelope', function (envelope, callback) {
    debug('envelope: %o', envelope)
    // Validate envelope schema and signature.
    if (!validate.envelope(envelope)) return callback()
    // Validate payload.
    if (!validate.payload(envelope.entry.payload)) return callback()
    // Ensure payload is for this project.
    if (envelope.entry.project !== discoveryKey) return callback()
    // Discover type and write to our database.
    var type = envelope.entry.payload.type
    var digest
    if (type === 'draft') {
      digest = hash(stringify(envelope.entry))
      debug('received draft')
      database.putDraft(digest, envelope, callback)
    } else if (type === 'note') {
      digest = hash(stringify(envelope.entry))
      debug('received note')
      database.putNote(digest, envelope, callback)
    } else if (type === 'mark') {
      debug('received mark')
      database.putMark(envelope, callback)
    } else if (type === 'intro') {
      debug('received intro')
      database.putIntro(envelope, callback)
    } else {
      callback()
    }
  })

  // Extend our handshake.
  protocol.handshake(function () { /* noop */ })

  return protocol
}
