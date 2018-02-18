var AJV = require('AJV')
var ajv = new AJV()

exports.draft = ajv.compile(require('./draft'))
exports.envelope = ajv.compile(require('./envelope'))
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
