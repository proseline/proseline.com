var assert = require('assert')
var initializeEditor = require('../editor')
var renderDraftHeader = require('./partials/draft-header')
var renderExpandingTextArea = require('./partials/expanding-textarea')
var renderIntro = require('./partials/intro')
var renderLoading = require('./loading')
var renderRefreshNotice = require('./partials/refresh-notice')
var renderRelativeTimestamp = require('./partials/relative-timestamp')
var withProject = require('./with-project')

module.exports = withProject(function (state, send, discoveryKey, digest) {
  state.route = 'viewer'
  var main = document.createElement('main')
  if (state.draft && state.draft.digest === digest) {
    if (state.changed) {
      main.appendChild(renderRefreshNotice(function () {
        send('reload draft', {discoveryKey, digest})
      }))
    }
    var draft = state.draft
    var div = document.createElement('div')
    div.className = 'editor'
    var editor = initializeEditor({
      element: div,
      content: draft.message.body.text,
      renderNoteForm: renderNoteForm.bind(null, state, send),
      renderNote: renderNote.bind(null, state, send),
      notes: state.notesTree,
      renderMarkForm: renderMarkForm.bind(null, state, send),
      dirty: function (modified) {
        if (!saveForm) return
        saveForm.className = SAVE_FORM_CLASS + (modified ? '' : ' hidden')
      }
    })
    var saveForm = renderSaveForm(state, send, editor)
    main.appendChild(renderDraftHeader(state, saveForm))
    main.appendChild(div)
  } else {
    main.appendChild(
      renderLoading(function () {
        send('load draft', {
          discoveryKey: discoveryKey,
          digest: digest
        })
      })
    )
  }
  return main
})

var SAVE_FORM_CLASS = 'saveDraftForm'

function renderSaveForm (state, send, editor) {
  var form = document.createElement('form')
  form.className = SAVE_FORM_CLASS + ' hidden'

  form.addEventListener('submit', function (event) {
    event.preventDefault()
    event.stopPropagation()
    send('save', {
      discoveryKey: state.discoveryKey,
      text: editor.state.doc.toJSON(),
      parents: [state.draft.digest]
    })
  })

  // Save Button
  var save = document.createElement('button')
  form.appendChild(save)
  save.className = 'button'
  save.appendChild(document.createTextNode('Save'))
  return form
}

var SEPARATOR = '\n\n'

function renderText (text) {
  var fragment = document.createDocumentFragment()
  text
    .split(SEPARATOR)
    .forEach(function (line) {
      // <p>
      var p = document.createElement('p')
      fragment.appendChild(p)
      p.appendChild(document.createTextNode(line))
    })
  return fragment
}

function renderMarkForm (state, send) {
  var form = document.createElement('form')
  form.id = 'markDraft'
  form.addEventListener('submit', function (event) {
    event.preventDefault()
    event.stopPropagation()
    var name = input.value
    var continuing = marksICanMove.find(function (mark) {
      return mark.message.body.name === name
    })
    send('mark', {
      name: name,
      identifier: continuing
        ? continuing.message.body.identifier
        : null
    })
  })

  var input = document.createElement('input')
  input.required = true
  form.appendChild(input)

  var marksICanMove = state.projectMarks.filter(function (mark) {
    return (
      mark.publicKey === state.identity.publicKey &&
      mark.message.body.draft !== state.draft.digest
    )
  })
  if (marksICanMove.length !== 0) {
    var datalist = document.createElement('datalist')
    form.appendChild(datalist)
    datalist.id = 'marksICanMove'
    input.setAttribute('list', datalist.id)
    marksICanMove.forEach(function (mark) {
      var option = document.createElement('option')
      datalist.appendChild(option)
      option.value = mark.message.body.name
    })
  }

  var button = document.createElement('button')
  button.type = 'submit'
  button.appendChild(document.createTextNode('Put a mark on this draft.'))
  form.appendChild(button)

  return form
}

function renderNote (state, send, note) {
  var aside = document.createElement('aside')
  aside.className = 'note'
  aside.id = note.digest
  var replyTo = state.replyTo
  // <p>
  var p = document.createElement('p')
  p.className = 'byline'
  p.appendChild(renderIntro(state, note.publicKey))
  p.appendChild(document.createTextNode(' '))
  p.appendChild(renderRelativeTimestamp(note.message.body.timestamp))
  p.appendChild(document.createTextNode(':'))
  aside.appendChild(p)
  // <blockquote>
  var blockquote = document.createElement('blockquote')
  blockquote.appendChild(renderText(note.message.body.text))
  aside.appendChild(blockquote)
  if (replyTo === note.digest) {
    aside.appendChild(renderNoteForm(state, send, {parent: note.digest}))
  } else {
    // <button>
    var button = document.createElement('button')
    button.addEventListener('click', function () {
      send('reply to', note.digest)
    })
    button.appendChild(document.createTextNode('Reply to this note.'))
    aside.appendChild(button)
  }
  if (note.children.length !== 0) {
    var ol = document.createElement('ol')
    note.children.forEach(function (child) {
      ol.appendChild(renderNote(state, send, child))
    })
    aside.appendChild(ol)
  }
  return aside
}

function renderNoteForm (state, send, options) {
  options = options || {}
  var parent = options.parent
  var range = options.range
  var selected = options.selected
  assert(typeof state, 'object')
  assert(!parent || typeof parent === 'string')
  assert(
    !range ||
    (
      typeof range === 'object' &&
      range.hasOwnProperty('start') &&
      range.hasOwnProperty('end')
    )
  )
  assert(!selected || typeof selected === 'string')
  assert.equal(typeof send, 'function')
  var form = document.createElement('form')
  form.className = 'noteForm'
  form.addEventListener('submit', function (event) {
    event.preventDefault()
    event.stopPropagation()
    send('note', {
      parent,
      range,
      text: textarea.value
    })
  })
  // <textarea>
  var textarea = renderExpandingTextArea()
  textarea.required = true
  textarea.autofocus = false
  form.appendChild(textarea)
  // <button>
  var button = document.createElement('button')
  button.type = 'submit'
  button.appendChild(
    document.createTextNode(
      parent ? 'Add your reply.' : 'Add your note.'
    )
  )
  form.appendChild(button)
  return form
}
