var dropCursor = require('prosemirror-dropcursor').dropCursor
var gapCursor = require('prosemirror-gapcursor').gapCursor
var keyMap = require('./key-map')
var menu = require('./menu')
var pmHistory = require('prosemirror-history')
var pmState = require('prosemirror-state')
var pmView = require('prosemirror-view')
var schema = require('./schema')

var EditorState = pmState.EditorState
var EditorView = pmView.EditorView
var history = pmHistory.history

module.exports = function (parent) {
  return new EditorView(parent, {
    state: EditorState.create({
      doc: schema.node('doc', null, [
        schema.node('paragraph', null, [])
      ]),
      plugins: [
        menu,
        history(),
        keyMap,
        dropCursor(),
        gapCursor()
      ]
    })
  })
}
