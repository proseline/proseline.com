var pmModel = require('prosemirror-model')

var Schema = pmModel.Schema

module.exports = new Schema({
  nodes: {
    doc: {
      content: 'block+'
    },
    paragraph: withTag('p', {
      content: 'inline+',
      group: 'block'
    }),
    blockquote: withTag('blockquote', {
      content: 'block+',
      group: 'block'
    }),
    rule: {
      group: 'block',
      parseDOM: [{tag: 'hr'}],
      toDOM: function () { return ['hr'] }
    },
    heading: {
      attrs: {level: {default: 1}},
      content: 'inline+',
      group: 'block',
      defining: true,
      parseDOM: new Array(6).map(function (_, index) {
        return {tag: 'h' + index + 1, attrs: {level: index + 1}}
      }),
      toDOM: function (node) { return ['h' + node.attrs.level, 0] }
    },
    codeBlock: {
      content: 'text',
      group: 'block',
      code: true,
      defining: true,
      parseDOM: [{tag: 'pre'}],
      toDOM: function () { return ['pre', {}, ['code', 0]] }
    },
    ol: withTag('ol', {
      content: 'li+',
      group: 'block'
    }),
    ul: withTag('ul', {
      content: 'li+',
      group: 'block'
    }),
    li: withTag('li', {
      content: 'paragraph block*',
      defining: true
    }),
    br: withTag('hr', {
      inline: true,
      groupi: 'inline',
      selectable: false
    }),
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
    link: {
      attrs: {href: {}},
      inclusive: false,
      parseDOM: [
        {
          tag: 'a[href]',
          getAttrs: function (dom) {
            return {href: dom.getAttribute('href')}
          }
        }
      ],
      toDOM: function (node) { return ['a', {href: node.attrs.href}] }
    },
    code: {
      parseDOM: [{tag: 'code'}],
      toDOM: function () { return ['code'] }
    }
  }
})

function withTag (tagName, spec) {
  spec.parseDOM = [{tag: tagName}]
  spec.toDOM = function () { return [tagName, {}, 0] }
  return spec
}
