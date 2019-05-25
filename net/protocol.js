var EncryptedJSONProtocol = require('encrypted-json-protocol')
var schemas = require('@proseline/schemas')

module.exports = EncryptedJSONProtocol({
  version: 3,
  messages: {
    offer: { schema: schemas.reference },
    request: { schema: schemas.reference },
    outerEnvelope: { schema: schemas.outerEnvelope }
  }
})
