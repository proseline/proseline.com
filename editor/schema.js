const pmModel = require('prosemirror-model')

const Schema = pmModel.Schema

module.exports = new Schema({
  nodes: {
    doc: {
      content: 'block+'
    },
    paragraph: {
      group: 'block',
      content: 'inline*',
      parseDOM: [{ tag: 'p' }],
      toDOM: function () { return ['p', 0] }
    },
    heading: {
      group: 'block',
      content: 'inline*',
      attrs: { level: { default: 1 } },
      defining: true,
      parseDOM: new Array(6)
        .fill()
        .map(index => {
          const level = index + 1
          return { tag: 'h' + level, attrs: { level } }
        }),
      toDOM: node => ['h' + node.attrs.level, 0]
    },
    blockquote: {
      group: 'block',
      content: 'block*',
      parseDOM: [{ tag: 'blockquote' }],
      toDOM: function () { return ['blockquote', 0] }
    },
    listing: {
      group: 'block',
      content: 'text*',
      code: true,
      defining: true,
      parseDOM: [{ tag: 'pre' }],
      toDOM: function () { return ['pre', {}, ['code', 0]] }
    },
    hr: {
      group: 'block',
      parseDOM: [{ tag: 'hr' }],
      toDOM: function () { return ['hr'] }
    },
    br: {
      inline: true,
      group: 'inline',
      selectable: false,
      parseDOM: [{ tag: 'br' }],
      toDOM: function () { return ['br'] }
    },
    text: {
      group: 'inline',
      toDOM: node => node.text
    }
  },
  marks: {
    em: {
      parseDOM: [{ tag: 'i' }, { tag: 'em' }],
      toDOM: function () { return ['em'] }
    },
    strong: {
      parseDOM: [{ tag: 'b' }, { tag: 'strong' }],
      toDOM: function () { return ['strong'] }
    },
    code: {
      parseDOM: [{ tag: 'code' }],
      toDOM: function () { return ['code'] }
    }
  }
})
