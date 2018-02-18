var Protocol = require('./protocol')
var assert = require('assert')
var flushWriteStream = require('flush-write-stream')
var hash = require('../crypto/hash')
var stringify = require('../utilities/stringify')
var validate = require('../schemas/validate')

module.exports = function (options) {
  assert.equal(typeof options.secretKey, 'string')
  assert.equal(typeof options.discoveryKey, 'string')
  assert(Buffer.isbuffer(options.nonce))
  assert(Buffer.isbuffer(options.peerNonce))
  assert(options.data)
  var discoveryKey = options.discoveryKey
  var data = options.data

  var protocol = new Protocol(options)

  // Store a list of envelopes that we've requested, so we can
  // check the list to avoid offering this peer envelopes we've
  // just received from it.
  var requestedFromPeer = []

  // Stream log information from our database.
  var logsStream = data.createLogsStream()
  var updateStream = data.createUpdateStream()

  // Offer currently known logs.
  logsStream
    .pipe(flushWriteStream.obj(function (chunk, _, done) {
      protocol.offer(chunk, done)
    }))
    .once('finish', function () {
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

  // When our peer requests an envelope...
  protocol.on('request', function (message, callback) {
    var publicKey = message.publicKey
    var index = message.index
    data.getEnvelope(publicKey, index, function (error, envelope) {
      if (error) return callback(error)
      if (envelope === undefined) return callback()
      protocol.envelope(envelope, callback)
    })
  })

  // TODO: Prevent duplicate requests for the same envelope.

  // When our peer offers envelopes...
  protocol.on('offer', function (message, callback) {
    var publicKey = message.publicKey
    var offeredIndex = message.index
    data.getLogHead(publicKey, function (error, head) {
      if (error) return callback(error)
      if (head !== undefined && head >= offeredIndex) return callback()
      var index = head ? (head + 1) : 0
      requestNextEnvelope()
      function requestNextEnvelope () {
        if (index > offeredIndex) return callback()
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
      data.putDraft(digest, envelope, callback)
    } else if (type === 'note') {
      digest = hash(stringify(envelope.entry))
      data.putNote(digest, envelope, callback)
    } else if (type === 'mark') {
      data.putMark(envelope, callback)
    } else if (type === 'intro') {
      data.putIntro(envelope, callback)
    } else {
      callback()
    }
  })

  // Extend our handshake.
  protocol.handshake({version: 1})
}
