var commands = require('./commands')
var pmHistory = require('prosemirror-history')
var pmKeyMap = require('prosemirror-keymap')

var keymap = pmKeyMap.keymap
var redo = pmHistory.redo
var undo = pmHistory.undo

module.exports = keymap({
  'Mod-z': undo,
  'Mod-y': redo,
  'Mod-b': commands.strong,
  'Mod-i': commands.em,
  'Mod-`': commands.code,
  'Backspace': commands.backspace,
  'Delete': commands.delete,
  'Mod-a': commands.selectAll,
  'Enter': commands.enter,
  'Ctrl-Enter': commands.br,
  'Shift-Enter': commands.hr
})
