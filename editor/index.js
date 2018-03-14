/* globals Node */
var assert = require('assert')
var dropCursor = require('prosemirror-dropcursor').dropCursor
var gapCursor = require('prosemirror-gapcursor').gapCursor
var keyMap = require('./key-map')
var menu = require('./menu')
var pmHistory = require('prosemirror-history')
var pmState = require('prosemirror-state')
var pmView = require('prosemirror-view')
var schema = require('./schema')

var Decoration = pmView.Decoration
var DecorationSet = pmView.DecorationSet
var EditorState = pmState.EditorState
var EditorView = pmView.EditorView
var Plugin = pmState.Plugin
var history = pmHistory.history

module.exports = function (options) {
  var element = options.element
  assert(element instanceof Node)
  var content = options.content
  var noteForm = options.noteForm
  assert(!noteForm || typeof noteForm === 'function')
  var globalNotes = options.globalNotes
  assert(!globalNotes || globalNotes instanceof Node)
  var doc = content
    ? schema.nodeFromJSON(content)
    : schema.node('doc', null, [
      schema.node('paragraph', null, [])
    ])
  var plugins = [
    menu,
    history(),
    keyMap,
    dropCursor(),
    gapCursor()
  ]
  if (globalNotes) {
    var globalNotePlugin = new Plugin({
      props: {
        decorations: function (state) {
          var ignore = {
            stopEvent: function () { return true },
            ignoreMutation: function () { return true }
          }
          var decorations = []
          if (globalNotes) {
            decorations.push(
              Decoration.widget(state.doc.content.size, globalNotes, ignore)
            )
          }
          return DecorationSet.create(state.doc, decorations)
        }
      }
    })
    plugins.push(globalNotePlugin)
  }
  return new EditorView(element, {
    state: EditorState.create({doc, plugins})
  })
}
