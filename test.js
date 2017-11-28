var AJV = require('ajv')
var assert = require('assert')

var ajv = new AJV()

function validate (name) {
  var schema = require('./schemas/' + name)
  ajv.validateSchema(schema)
  assert.deepEqual(ajv.errors, null, name + ' schema')
}

validate('draft')
validate('envelope')
validate('introduction')
validate('marker')
validate('note')
