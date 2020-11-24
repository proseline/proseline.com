const AJV = require('ajv')
const ajv = new AJV()

exports.handshake = ajv.compile(require('./handshake'))
exports.log = ajv.compile(require('./log'))
exports.tuple = ajv.compile(require('./tuple'))
