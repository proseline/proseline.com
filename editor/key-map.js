var commands = require('./commands')
var eachHeadingLevel = require('./each-heading-level')
var pmHistory = require('prosemirror-history')
var pmKeyMap = require('prosemirror-keymap')

var keymap = pmKeyMap.keymap
var redo = pmHistory.redo
var undo = pmHistory.undo

var mappings = {
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
}

eachHeadingLevel(function (level) {
  mappings['Ctrl-Shift-' + level] = commands['h' + level]
})

module.exports = keymap(mappings)
