var pmModel = require('prosemirror-model')

var Schema = pmModel.Schema

module.exports = new Schema({
  nodes: {
    doc: {
      content: 'block+'
    },
    paragraph: {
      group: 'block',
      content: 'inline*',
      parseDOM: [{tag: 'p'}],
      toDOM: function () { return ['p', 0] }
    },
    hr: {
      group: 'block',
      parseDOM: [{tag: 'hr'}],
      toDOM: function () { return ['hr'] }
    },
    br: {
      inline: true,
      group: 'inline',
      selectable: false,
      parseDOM: [{tag: 'br'}],
      toDOM: function () { return ['br'] }
    },
    text: {
      group: 'inline',
      toDOM: function (node) { return node.text }
    }
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
