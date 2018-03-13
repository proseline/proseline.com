var commands = require('./commands')
var pmMenu = require('prosemirror-menu')
var schema = require('./schema')

var MenuItem = pmMenu.MenuItem
var icons = pmMenu.icons

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
