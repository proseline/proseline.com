var AJV = require('ajv')
var ajv = new AJV()
var stringify = require('../utilities/stringify')
var verify = require('../crypto/verify')

exports.draft = ajv.compile(require('./draft'))
exports.envelopeData = ajv.compile(require('./envelope'))
exports.envelope = function (envelope) {
  return (
    exports.envelopeData(envelope) &&
    verify(
      stringify(envelope.entry),
      envelope.signature,
      envelope.publicKey
    )
  )
}
exports.identity = ajv.compile(require('./identity'))
exports.intro = ajv.compile(require('./intro'))
exports.mark = ajv.compile(require('./mark'))
exports.note = ajv.compile(require('./note'))

exports.payload = function (argument) {
  return (
    exports.draft(argument) ||
    exports.intro(argument) ||
    exports.mark(argument) ||
    exports.note(argument)
  )
}
