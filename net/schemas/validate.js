var AJV = require('ajv')
var ajv = new AJV()

exports.handshake = ajv.compile(require('./handshake'))
exports.log = ajv.compile(require('./log'))
exports.message = ajv.compile(require('./message'))
