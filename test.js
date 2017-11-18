var AJV = require('ajv')
var assert = require('assert')

var ajv = new AJV()

var documentSchema = require('./schemas/document')
ajv.validateSchema(documentSchema)
assert.deepEqual(ajv.errors, null, 'document schema')

var markerSchema = require('./schemas/marker')
ajv.validateSchema(markerSchema)
assert.deepEqual(ajv.errors, null, 'marker schema')

var noteSchema = require('./schemas/note')
ajv.validateSchema(noteSchema)
assert.deepEqual(ajv.errors, null, 'note schema')

var draftSchema = require('./schemas/draft')
ajv.validateSchema(draftSchema)
assert.deepEqual(ajv.errors, null, 'draft schema')
