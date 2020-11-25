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

module.exports = ({
  element,
  content,
  renderNoteForm,
  renderNote,
  renderMarkForm,
  notes,
  dirty,
  prior
}) => {
  assert(element instanceof Node)
  assert(!renderNoteForm || typeof renderNoteForm === 'function')
  assert(!renderNote || typeof renderNote === 'function')
  assert(!renderMarkForm || typeof renderMarkForm === 'function')
  assert(!notes || Array.isArray(notes))
  assert(!dirty || typeof dirty === 'function')
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
        decorations: state => {
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
        decorations: state => {
          if (modifiedPlugin.getState(state)) return
          const decorations = []
          notes.forEach(note => {
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
          decorations: state => {
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
      apply: (tr, oldState, newState) => {
        const modified = !newState.doc.eq(originalDocument)
        return oldState || modified
      }
    },
    view: view => {
      return {
        update: view => {
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
