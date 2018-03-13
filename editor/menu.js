var commands = require('./commands')
var pmMenu = require('prosemirror-menu')
var schema = require('./schema')

var MenuItem = pmMenu.MenuItem
var icons = pmMenu.icons
var blockTypeItem = pmMenu.blockTypeItem
var Dropdown = pmMenu.Dropdown

var headingItems = []
for (var level = 1; level <= 6; level++) {
  headingItems.push(blockTypeItem(schema.nodes.heading, {
    title: 'Heading ' + level,
    label: 'H' + level,
    attrs: {level: level}
  }))
}

module.exports = pmMenu.menuBar({
  floating: true,
  content: [
    [
      new MenuItem({
        title: 'Strong',
        label: 'Strong',
        icon: icons.strong,
        active: function (state) {
          return isMarkActive(state, schema.marks.strong)
        },
        enable: function (state) {
          return !state.selection.empty
        },
        run: commands.strong
      }),
      new MenuItem({
        title: 'Emphasis',
        label: 'Emphasis',
        icon: icons.em,
        active: function (state) {
          return isMarkActive(state, schema.marks.em)
        },
        enable: function (state) {
          return !state.selection.empty
        },
        run: commands.em
      }),
      new MenuItem({
        title: 'Code',
        label: 'Code',
        icon: icons.code,
        active: function (state) {
          return isMarkActive(state, schema.marks.code)
        },
        enable: function (state) {
          return !state.selection.empty
        },
        run: commands.code
      })
    ],
    [
      new MenuItem({
        title: 'Bullet List',
        label: 'Bullets',
        icon: icons.bulletList,
        active: commands.ul,
        run: commands.ul
      }),
      new MenuItem({
        title: 'Ordered List',
        label: 'Ordered',
        icon: icons.orderedList,
        active: commands.ol,
        run: commands.ol
      }),
      new MenuItem({
        title: 'Blockquote',
        label: 'Blockquote',
        icon: icons.blockquote,
        active: commands.blockquote,
        run: commands.blockquote
      }),
      blockTypeItem(schema.nodes.paragraph, {
        title: 'Paragraph',
        label: 'Paragraph'
      }),
      blockTypeItem(schema.nodes.codeBlock, {
        title: 'Code Block',
        label: 'Code'
      }),
      new MenuItem({
        title: 'Rule',
        label: 'Rule',
        icon: icons.hr,
        active: commands.hr,
        run: commands.hr
      })
    ],
    [
      new Dropdown(headingItems, {label: 'Heading'})
    ],
    [
      pmMenu.undoItem,
      pmMenu.redoItem
    ]
  ]
})

function isMarkActive (state, type) {
  var empty = state.selection.empty
  var $from = state.selection.$from
  if (empty) {
    return type.isInSet(state.storedMarks || $from.marks())
  }
  var from = state.selection.from
  var to = state.selection.to
  return state.doc.rangeHasMark(from, to, type)
}
