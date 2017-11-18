var blockElements = [
  'blockquote', 'heading', 'hr', 'img', 'ol', 'p', 'pre', 'ul'
]

var inlineElements = ['a', 'code', 'em', 'string']

var headings = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']

var elements = {
  a: {
    href: {type: 'string', format: 'uri'},
    content: ref('arrayOfInlineElements')
  },
  blockquote: {content: ref('arrayOfInlineElements')},
  code: {content: ref('arrayOfInlineElements')},
  em: {content: ref('arrayOfInlineElements')},
  h1: {content: ref('arrayOfInlineElements')},
  h2: {content: ref('arrayOfInlineElements')},
  h3: {content: ref('arrayOfInlineElements')},
  h4: {content: ref('arrayOfInlineElements')},
  h5: {content: ref('arrayOfInlineElements')},
  h6: {content: ref('arrayOfInlineElements')},
  hr: {},
  img: {
    alt: {type: 'string'},
    src: {type: 'string', format: 'uri'}
  },
  ol: {content: ref('arrayOfListItems')},
  p: {content: ref('arrayOfInlineElements')},
  pre: {text: ref('textNode')},
  strong: {content: ref('arrayOfInlineElements')},
  textNode: {type: 'string', minLength: 1},
  ul: {content: ref('arrayOfListItems')},
  li: {content: ref('arrayOfBlockElements')}
}

var exported = arrayOf(blockElements.map(ref))

exported.definitions = {
  blockElement: oneOf(blockElements.map(ref)),
  arrayOfBlockElements: arrayOf(blockElements.map(ref)),
  inlineElement: oneOf(inlineElements.map(ref)),
  arrayOfInlineElements: arrayOf(inlineElements.map(ref)),
  heading: oneOf(headings.map(ref)),
  arrayOfListItems: arrayOf(ref('li'))
}

Object.keys(elements).forEach(function (name) {
  exported.definitions[name] = element(name, elements[name])
})

module.exports = exported

function oneOf (list) {
  return {oneOf: list}
}

function ref (id) {
  return {$ref: '#/definitions/' + id}
}

function arrayOf (items) {
  return {
    type: 'array',
    minItems: 1,
    items: items
  }
}

function element (name, properties) {
  var returned = {
    type: 'object',
    properties: {
      element: {const: name}
    },
    required: ['name'],
    additionalProperties: false
  }
  Object.keys(properties).forEach(function (key) {
    returned.properites = properties[key]
    returned.required.push(key)
  })
  return returned
}
