/* globals Node */
var assert = require('assert')
var classnames = require('classnames')
var diff = require('rfc6902-json-diff')
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
var PluginKey = pmState.PluginKey
var history = pmHistory.history

var COMPARE_META_KEY = 'compare'

module.exports = function (options) {
  var element = options.element
  assert(element instanceof Node)
  var content = options.content
  var renderNoteForm = options.renderNoteForm
  assert(!renderNoteForm || typeof renderNoteForm === 'function')
  var renderNote = options.renderNote
  assert(!renderNote || typeof renderNote === 'function')
  var renderMarkForm = options.renderMarkForm
  assert(!renderMarkForm || typeof renderMarkForm === 'function')
  var notes = options.notes
  assert(!notes || Array.isArray(notes))
  var dirty = options.dirty
  assert(!dirty || typeof dirty === 'function')
  var prior = options.prior
  assert(!prior || typeof prior === 'object')

  var originalDocument = content
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
  var ignore = {
    stopEvent: function () { return true },
    ignoreMutation: function () { return true }
  }

  if (renderNoteForm) {
    var inlineNotePlugin = new Plugin({
      props: {
        decorations: function (state) {
          if (modifiedPlugin.getState(state)) return
          var decorations = []
          var selection = state.selection
          if (!selection.empty) {
            var $to = selection.$to
            var $from = selection.$from
            decorations.push(
              Decoration.widget(
                $to.after(),
                renderNoteForm({range: {start: $from.pos, end: $to.pos}}),
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
    var notesPlugin = new Plugin({
      props: {
        decorations: function (state) {
          if (modifiedPlugin.getState(state)) return
          var decorations = []
          notes.forEach(function (note) {
            var $start = state.doc.resolve(note.message.body.range.start)
            var $end = state.doc.resolve(note.message.body.range.end)
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
                {class: 'highlight'}
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

  var modifiedPlugin = new Plugin({
    key: new PluginKey('modified'),
    state: {
      init: function () { return false },
      apply: function (tr, oldState, newState) {
        var modified = !newState.doc.eq(originalDocument)
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

  if (prior) {
    var comparisonDecorations = new Plugin({
      state: {
        init: function () { return {comparing: false} },
        apply: function (tr, oldState) {
          var meta = tr.getMeta(COMPARE_META_KEY)
          if (meta) return meta
          else return oldState
        }
      },
      props: {
        decorations: function (state) {
          if (this.getState(state).comparing) {
            var current = state.doc.toJSON()
            var patch = diff(prior, current)
            var decorations = []
            console.log(patch)
            patch.forEach(function (operation) {
              var type = operation.op
              var path = operation.path
              var doc = state.doc
              var descended = descend(doc, path)
              console.log(descended)
              var $position = doc.resolve(descended.position)
              if (type === 'replace') {
                if (path.endsWith('/text')) {
                  decorations.push(
                    Decoration.widget(
                      $position.start(),
                      (function () {
                        var del = document.createElement('del')
                        del.appendChild(document.createTextNode(operation.value))
                        return del
                      })(),
                      ignore
                    )
                  )
                  decorations.push(
                    Decoration.inline(
                      $position.pos,
                      $position.end(),
                      {class: 'added'}
                    )
                  )
                }
              } else if (type === 'add') {
                console.log($position.parent.type.name)
                decorations.push(
                  Decoration.inline(
                    $position.pos,
                    $position.end(),
                    {class: 'added'}
                  )
                )
              }
            })
            return DecorationSet.create(state.doc, decorations)
          }
        }
      }
    })
    plugins.push(comparisonDecorations)

    var compareUI = new Plugin({
      view: function (view) {
        return compareView(view, modifiedPlugin, comparisonDecorations)
      }
    })
    plugins.push(compareUI)
  }

  return new EditorView(element, {
    state: EditorState.create({doc: originalDocument, plugins})
  })
}

function descend (node, path) {
  var split = path.split('/')
  var pathIndex = 1
  var position = 0
  while (split[pathIndex] === 'content') {
    // Don't increment position for the first child within state.doc.
    // For every level after that, increment for the start token.
    var childIndex = parseInt(split[pathIndex + 1])
    for (var before = 0; before < childIndex; before++) {
      position += node.child(before).nodeSize
    }
    if (pathIndex > 1) position += 1
    node = node.child(childIndex)
    pathIndex += 2
  }
  return {node, position}
}

function compareView (view, modifiedPlugin, comparisonPlugin) {
  var section = document.createElement('section')

  var button = document.createElement('button')
  section.appendChild(button)
  button.appendChild(document.createTextNode('Compare'))
  button.addEventListener('click', function (event) {
    event.preventDefault()
    command(view.state, view.dispatch)
  })

  view.dom.parentNode.appendChild(section)
  update(view, null)

  return {update, destroy}

  function update (view, lastState) {
    var pluginState = comparisonPlugin.getState(view.state)
    var modifiedState = modifiedPlugin.getState(view.state)
    section.className = classnames({
      hidden: pluginState.comparing || modifiedState
    })
  }

  function destroy () {
    section.remove()
  }

  function command (state, dispatch) {
    if (dispatch) {
      dispatch(state.tr.setMeta(COMPARE_META_KEY, {comparing: true}))
    }
    return true
  }
}
