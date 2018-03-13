var pmModel = require('prosemirror-model')

var Schema = pmModel.Schema

module.exports = new Schema({
  nodes: {
    doc: {
      content: 'paragraph+'
    },
    paragraph: {
      content: 'text+',
      parseDOM: [{tag: 'p'}],
      toDOM: function () { return ['p', 0] }
    },
    text: {}
  },
  marks: {
    em: {
      parseDOM: [{tag: 'i'}, {tag: 'em'}],
      toDOM: function () { return ['em'] }
    },
    strong: {
      parseDOM: [{tag: 'b'}, {tag: 'strong'}],
      toDOM: function () { return ['strong'] }
    },
    code: {
      parseDOM: [{tag: 'code'}],
      toDOM: function () { return ['code'] }
    }
  }
})
