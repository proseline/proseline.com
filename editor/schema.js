var pmModel = require('prosemirror-model')

var Schema = pmModel.Schema

var BLOCK = 'block'
var INLINE = 'inline'

module.exports = new Schema({
  nodes: {
    doc: {
      content: `${BLOCK}+`
    },
    paragraph: withTag('p', {
      content: `${INLINE}+`,
      group: BLOCK
    }),
    blockquote: withTag('blockquote', {
      content: `${BLOCK}+`,
      group: BLOCK
    }),
    rule: {
      group: BLOCK,
      parseDOM: [{tag: 'hr'}],
      toDOM: function () { return ['hr'] }
    },
    heading: {
      attrs: {level: {default: 1}},
      content: `${INLINE}+`,
      group: BLOCK,
      defining: true,
      parseDOM: new Array(6).map(function (_, index) {
        return {tag: 'h' + index + 1, attrs: {level: index + 1}}
      }),
      toDOM: function (node) { return ['h' + node.attrs.level, 0] }
    },
    codeBlock: {
      content: 'text+',
      group: BLOCK,
      code: true,
      defining: true,
      marks: '',
      parseDOM: [{tag: 'pre'}],
      toDOM: function () { return ['pre', {}, ['code', 0]] }
    },
    ol: withTag('ol', {
      content: 'li+',
      group: BLOCK
    }),
    ul: withTag('ul', {
      content: 'li+',
      group: BLOCK
    }),
    li: withTag('li', {
      content: `paragraph ${BLOCK}*`,
      defining: true
    }),
    br: withTag('br', {
      inline: true,
      group: INLINE,
      selectable: false
    }),
    text: {
      group: INLINE,
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
