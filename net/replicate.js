var Protocol = require('./protocol')
var assert = require('assert')
var debug = require('debug')('proseline:replicate')
var flushWriteStream = require('flush-write-stream')
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

  protocol.once('handshake', function (callback) {
    database.createOfferStream()
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
          requestedFromPeer.splice(requestIndex, 1)
          done()
        }
      }))
    callback()
  })

  // When our peer requests an envelope...
  protocol.on('request', function (request, callback) {
    debug('requested: %o', request)
    var publicKey = request.publicKey
    var index = request.index
    database.getEnvelope(publicKey, index, function (error, envelope) {
      if (error) return callback(error)
      if (envelope === undefined) return callback()
      protocol.envelope(envelope, callback)
    })
  })

  // TODO: Prevent duplicate requests for the same envelope.

  // When our peer offers envelopes...
  protocol.on('offer', function (offer, callback) {
    debug('offered: %o', offer)
    var publicKey = offer.publicKey
    var offeredIndex = offer.index
    database.getLogHead(publicKey, function (error, head) {
      if (error) return callback(error)
      if (head === undefined) head = -1
      var index = head + 1
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
    debug('sent envelope: %o', envelope)
    // Validate envelope schema and signature.
    if (!validate.envelope(envelope)) {
      debug('invalid envelope')
      return callback()
    }
    // Validate body.
    if (!validate.body(envelope.message.body)) {
      debug('invalid body')
      return callback()
    }
    // Ensure body is for this project.
    if (envelope.message.project !== discoveryKey) {
      debug('project mismatch')
      return callback()
    }
    // Write to our database.
    database.putEnvelope(envelope, callback)
  })

  // Extend our handshake.
  protocol.handshake(function () { /* noop */ })

  return protocol
}
