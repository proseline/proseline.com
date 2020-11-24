const EncryptedJSONProtocol = require('encrypted-json-protocol')
const schemas = require('@proseline/schemas')

module.exports = EncryptedJSONProtocol({
  version: 3,
  messages: {
    offer: { schema: schemas.reference },
    request: { schema: schemas.reference },
    envelope: { schema: schemas.envelope }
  }
})
