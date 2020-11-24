const commands = require('./commands')
const eachHeadingLevel = require('./each-heading-level')
const pmHistory = require('prosemirror-history')
const pmKeyMap = require('prosemirror-keymap')

const keymap = pmKeyMap.keymap
const redo = pmHistory.redo
const undo = pmHistory.undo

const mappings = {
  'Mod-z': undo,
  'Mod-y': redo,
  'Mod-b': commands.strong,
  'Mod-i': commands.em,
  'Mod-`': commands.code,
  Backspace: commands.backspace,
  Delete: commands.delete,
  'Mod-a': commands.selectAll,
  Enter: commands.enter,
  'Ctrl-Enter': commands.br,
  'Shift-Enter': commands.hr
}

eachHeadingLevel(level => {
  mappings['Ctrl-Shift-' + level] = commands['h' + level]
})

module.exports = keymap(mappings)
