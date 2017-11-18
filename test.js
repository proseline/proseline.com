var AJV = require('ajv')
var assert = require('assert')
var documentSchema = require('./schemas/document')

var ajv = new AJV()

ajv.validateSchema(documentSchema)
assert.deepEqual(ajv.errors, null, 'document schema')
