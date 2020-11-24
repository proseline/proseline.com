/* globals Node */
const assert = require('nanoassert')
const dropCursor = require('prosemirror-dropcursor').dropCursor
const gapCursor = require('prosemirror-gapcursor').gapCursor
const keyMap = require('./key-map')
const menu = require('./menu')
const pmHistory = require('prosemirror-history')
const pmState = require('prosemirror-state')
const pmView = require('prosemirror-view')
const schema = require('./schema')

const Decoration = pmView.Decoration
const DecorationSet = pmView.DecorationSet
const EditorState = pmState.EditorState
const EditorView = pmView.EditorView
const Plugin = pmState.Plugin
const PluginKey = pmState.PluginKey
const history = pmHistory.history

module.exports = function (options) {
  const element = options.element
  assert(element instanceof Node)
  const content = options.content
  const renderNoteForm = options.renderNoteForm
  assert(!renderNoteForm || typeof renderNoteForm === 'function')
  const renderNote = options.renderNote
  assert(!renderNote || typeof renderNote === 'function')
  const renderMarkForm = options.renderMarkForm
  assert(!renderMarkForm || typeof renderMarkForm === 'function')
  const notes = options.notes
  assert(!notes || Array.isArray(notes))
  const dirty = options.dirty
  assert(!dirty || typeof dirty === 'function')
  const prior = options.prior
  assert(!prior || typeof prior === 'object')

  const originalDocument = content
    ? schema.nodeFromJSON(content)
    : schema.node('doc', null, [
      schema.node('paragraph', null, [])
    ])
  const plugins = [
    menu,
    history(),
    keyMap,
    dropCursor(),
    gapCursor()
  ]
  const ignore = {
    stopEvent: function () { return true },
    ignoreMutation: function () { return true }
  }

  if (renderNoteForm) {
    const inlineNotePlugin = new Plugin({
      props: {
        decorations: function (state) {
          if (modifiedPlugin.getState(state)) return
          const decorations = []
          const selection = state.selection
          if (!selection.empty) {
            const $to = selection.$to
            const $from = selection.$from
            decorations.push(
              Decoration.widget(
                $to.after(),
                renderNoteForm({ range: { start: $from.pos, end: $to.pos } }),
                ignore
              )
            )
            return DecorationSet.create(state.doc, decorations)
          }
        }
      }
    })
    plugins.push(inlineNotePlugin)
  }

  if (notes) {
    const notesPlugin = new Plugin({
      props: {
        decorations: function (state) {
          if (modifiedPlugin.getState(state)) return
          const decorations = []
          notes.forEach(function (note) {
            const $start = state.doc.resolve(note.range.start)
            const $end = state.doc.resolve(note.range.end)
            decorations.push(
              Decoration.widget(
                $end.after(),
                renderNote(note),
                ignore
              )
            )
            decorations.push(
              Decoration.inline(
                $start.pos,
                $end.pos,
                { class: 'highlight' }
              )
            )
          })
          return DecorationSet.create(state.doc, decorations)
        }
      }
    })
    plugins.push(notesPlugin)
  }

  if (renderMarkForm) {
    plugins.push(
      new Plugin({
        props: {
          decorations: function (state) {
            if (modifiedPlugin.getState(state)) return
            return DecorationSet.create(
              state.doc,
              [Decoration.widget(0, renderMarkForm(), ignore)]
            )
          }
        }
      })
    )
  }

  const modifiedPlugin = new Plugin({
    key: new PluginKey('modified'),
    state: {
      init: function () { return false },
      apply: function (tr, oldState, newState) {
        const modified = !newState.doc.eq(originalDocument)
        return oldState || modified
      }
    },
    view: function (view) {
      return {
        update: function (view) {
          if (dirty) dirty(modifiedPlugin.getState(view.state))
        }
      }
    }
  })
  plugins.push(modifiedPlugin)

  return new EditorView(element, {
    state: EditorState.create({ doc: originalDocument, plugins })
  })
}
