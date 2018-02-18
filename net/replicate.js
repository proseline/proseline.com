var Protocol = require('./protocol')
var hash = require('../crypto/hash')
var pump = require('pump')
var stringify = require('../utilities/stringify')
var through2 = require('through2')
var validate = require('../schemas/validate')

module.exports = function (source) {
  var stream = new Protocol()

  var done = false
  var sentWants = false
  var sentHeads = false
  var peerSentWants = false
  var peerSentHeads = false

  function pipe (source, sink, done) {
    var destroy = function () {
      source.destroy()
    }

    stream.on('close', destroy)
    stream.on('finish', destroy)
    source.on('end', function () {
      stream.removeListener('close', destroy)
      stream.removeListener('finish', destroy)
    })
    return pump(source, sink, done)
  }

  function update (callback) {
    var waiting = (
      done ||
      !sentWants || !sentHeads ||
      !peerSentWants || !peerSentHeads
    )
    if (waiting) return callback()
    done = true
    sendChanges()
    callback()
  }

  function sendChanges () {
    pipe(source, through2.obj(function (chunk, _, callback) {
      stream.node(chunk, callback)
    }))
  }

  function sendSentWants (callback) {
    sentWants = true
    stream.sentWants()
    update(callback)
  }

  function sendSentHeads (callback) {
    sentHeads = true
    stream.sentHeads()
    update(callback)
  }

  function sendEntry (publicKey, index, callback) {
    source.getEntry(publicKey, index, function (error, entry) {
      if (error) return done(error)
      if (entry === undefined) done()
      // TODO: Send entry.
    })
  }

  function receiveEntry (envelope, callback) {
    if (!validate.envelope(envelope)) return callback()
    if (!validate.payload(envelope.entry.payload)) return callback()
    var type = envelope.entry.payload.type
    var digest
    if (type === 'draft') {
      digest = hash(stringify(envelope.entry))
      source.putDraft(digest, envelope, callback)
    } else if (type === 'note') {
      digest = hash(stringify(envelope.entry))
      source.putNote(digest, envelope, callback)
    } else if (type === 'mark') {
      source.putMark(envelope, callback)
    } else if (type === 'intro') {
      source.putIntro(envelope, callback)
    } else {
      callback()
    }
  }

  stream.once('sentHeads', function (callback) {
    if (!sentWants) sendSentWants(noop)
    peerSentHeads = true
    update(callback)
  })

  stream.once('sentWants', function (callback) {
    peerSentWants = true
    update(callback)
  })

  stream.on('want', function (publicKey, index, callback) {
    sendEntry(publicKey, index, callback)
  })

  stream.on('have', function (publicKey, index, callback) {
    source.getLogHead(publicKey, function (error, head) {
      if (error) return done(error)
      if (head && index > head) {
        stream.want({
          publicKey: publicKey,
          head: head || index
        }, callback)
      } else {
        callback()
      }
    })
  })

  stream.on('entry', receiveEntry)

  stream.on('handshake', function (handshake, callback) {
    pipe(
      source.streamLogs(),
      through2.obj(function (publicKey, _, done) {
        source.getLogHead(publicKey, function (error, head) {
          if (error) return callback(error)
          stream.have({
            publicKey: publicKey,
            head: head
          }, callback)
        })
      }),
      function (error) {
        if (error) return callback(error)
        sendSentHeads(callback)
      }
    )
  })

  // Extend our handshake.
  stream.handshake({version: 1})
}

function noop () { }
