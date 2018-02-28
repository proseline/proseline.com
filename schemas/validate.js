var AJV = require('ajv')
var stringify = require('../utilities/stringify')
var verify = require('../crypto/verify')

var ajv = new AJV()

// TODO: Note resolutions.
// TODO: Note edits.

exports.draft = ajv.compile(require('./draft'))
exports.envelopeData = ajv.compile(require('./envelope'))
exports.envelope = function (envelope) {
  return (
    exports.envelopeData(envelope) &&
    verify(
      stringify(envelope.message),
      envelope.signature,
      envelope.publicKey
    )
  )
}
exports.identity = ajv.compile(require('./identity'))
exports.intro = ajv.compile(require('./intro'))
exports.mark = ajv.compile(require('./mark'))
exports.noteData = ajv.compile(require('./note'))
exports.note = function (note) {
  return (
    exports.noteData(note) &&
    (
      !note.hasOwnProperty('range') ||
      note.range.start < note.range.end
    )
  )
}

exports.body = function (argument) {
  return (
    exports.draft(argument) ||
    exports.intro(argument) ||
    exports.mark(argument) ||
    exports.note(argument)
  )
}
