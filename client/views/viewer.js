const SVG = require('../svg')
const assert = require('nanoassert')
const beforeUnload = require('../before-unload')
const has = require('has')
const initializeEditor = require('../editor')
const onKeyDown = require('./on-key-down')
const renderBookmarkPath = require('./partials/bookmark-path')
const renderDraftHeader = require('./partials/draft-header')
const renderIntro = require('./partials/intro')
const renderLoading = require('./loading')
const renderRefreshNotice = require('./partials/refresh-notice')
const renderRelativeTimestamp = require('./partials/relative-timestamp')
const withProject = require('./with-project')

module.exports = withProject((state, send, discoveryKey, digest) => {
  state.route = 'viewer'
  // <main>
  const main = document.createElement('main')
  if (state.draft && state.draft.digest === digest) {
    if (state.changed) {
      main.appendChild(renderRefreshNotice(function () {
        send('reload draft', { discoveryKey, digest })
      }))
    }
    const draft = state.draft
    const div = document.createElement('div')
    div.className = 'editor'
    const editor = initializeEditor({
      element: div,
      content: draft.text,
      renderNoteForm: renderNoteForm.bind(null, state, send),
      renderNote: renderNote.bind(null, state, send),
      notes: state.notesTree,
      renderMarkForm: renderMarkForm.bind(null, state, send),
      dirty: dirty => {
        if (dirty) beforeUnload.enable()
        else beforeUnload.disable()
        if (saveForm) {
          saveForm.className = SAVE_FORM_CLASS + ' ' + (dirty ? '' : 'hidden')
        }
        if (bookmarks) {
          bookmarks.setAttributeNS(
            null, 'class', BOOKMARKS_CLASS + ' ' + (dirty ? 'hidden' : '')
          )
        }
      },
      prior: state.parents.length !== 0
        ? state.parents[0].text
        : undefined
    })
    div.onkeydown = onKeyDown(editor, [state.draft.digest], state, send)
    const saveForm = renderSaveForm(state, send, editor)
    main.appendChild(renderDraftHeader(state, saveForm))
    main.appendChild(div)
    let bookmarks
    if (state.projectMarks.filter(mark => {
      return mark.draft === state.draft.digest
    })) {
      const bookmarkWidth = 50
      bookmarks = document.createElementNS(SVG, 'svg')
      const marks = state.projectMarks.filter(mark => {
        return mark.draft === state.draft.digest
      })
      const othersMarks = []
      const ourMarks = []
      marks.forEach(mark => {
        (mark.envelope.logPublicKey === state.logKeyPair.publicKey ? ourMarks : othersMarks)
          .push(mark)
      })
      bookmarks.setAttributeNS(null, 'class', BOOKMARKS_CLASS)
      bookmarks.setAttributeNS(null, 'width', bookmarkWidth * 1.5)
      bookmarks.setAttributeNS(null, 'height', bookmarkWidth * 2)
      if (othersMarks.length !== 0) {
        bookmarks.appendChild(renderBookmarkPath(0, 0, 'blue', bookmarkWidth))
      }
      if (ourMarks.length !== 0) {
        bookmarks.appendChild(renderBookmarkPath(bookmarkWidth / 2, 0, 'red', bookmarkWidth))
      }
      main.appendChild(bookmarks)
    }
  } else {
    main.appendChild(
      renderLoading(function () {
        send('load draft', {
          discoveryKey,
          digest: digest
        })
      })
    )
  }
  return main
})

const SAVE_FORM_CLASS = 'saveDraftForm'
const BOOKMARKS_CLASS = 'bookmarks'

function renderSaveForm (state, send, editor) {
  // <form>
  const form = document.createElement('form')
  form.className = SAVE_FORM_CLASS + ' hidden'
  form.addEventListener('submit', event => {
    event.preventDefault()
    event.stopPropagation()
    send('save', {
      discoveryKey: state.discoveryKey,
      text: editor.state.doc.toJSON(),
      parents: [state.draft.digest]
    })
  })

  // <button>
  const save = document.createElement('button')
  form.appendChild(save)
  save.className = 'button'
  save.appendChild(document.createTextNode('Save'))
  return form
}

const SEPARATOR = '\n\n'

function renderText (text) {
  const fragment = document.createDocumentFragment()
  text
    .split(SEPARATOR)
    .forEach(line => {
      // <p>
      const p = document.createElement('p')
      fragment.appendChild(p)
      p.appendChild(document.createTextNode(line))
    })
  return fragment
}

function renderMarkForm (state, send) {
  // <form>
  const form = document.createElement('form')
  form.id = 'markDraft'
  form.addEventListener('submit', event => {
    event.preventDefault()
    event.stopPropagation()
    const name = input.value
    const continuing = marksICanMove.find(mark => {
      return mark.name === name
    })
    send('mark', {
      name: name,
      identifier: continuing
        ? continuing.identifier
        : null
    })
  })

  // <input>
  const input = document.createElement('input')
  input.required = true
  form.appendChild(input)

  const marksICanMove = state.projectMarks.filter(mark => {
    return (
      mark.envelope.logPublicKey === state.logKeyPair.publicKey &&
      mark.draft !== state.draft.digest
    )
  })
  if (marksICanMove.length !== 0) {
    // <datalist>
    const datalist = document.createElement('datalist')
    form.appendChild(datalist)
    datalist.id = 'marksICanMove'
    input.setAttribute('list', datalist.id)
    marksICanMove.forEach(mark => {
      const option = document.createElement('option')
      datalist.appendChild(option)
      option.value = mark.name
    })
  }

  // <button>
  const button = document.createElement('button')
  button.type = 'submit'
  button.appendChild(document.createTextNode('Put a mark on this draft.'))
  form.appendChild(button)

  return form
}

function renderNote (state, send, note) {
  // <aside>
  const aside = document.createElement('aside')
  aside.className = 'note'
  aside.id = note.digest
  const replyTo = state.replyTo

  // <p>
  const p = document.createElement('p')
  p.className = 'byline'
  p.appendChild(renderIntro(state, note.envelope.logPublicKey))
  p.appendChild(document.createTextNode(' '))
  p.appendChild(renderRelativeTimestamp(note.timestamp))
  p.appendChild(document.createTextNode(':'))
  aside.appendChild(p)

  // <blockquote>
  const blockquote = document.createElement('blockquote')
  aside.appendChild(blockquote)
  blockquote.appendChild(renderText(note.text))

  if (replyTo === note.digest) {
    aside.appendChild(renderNoteForm(state, send, { parent: note.digest }))
  } else {
    // <button>
    const button = document.createElement('button')
    aside.appendChild(button)
    button.addEventListener('click', function () {
      send('reply to', note.digest)
    })
    button.appendChild(document.createTextNode('Reply to this note.'))
  }

  if (note.children.length !== 0) {
    // <ol>
    const ol = document.createElement('ol')
    note.children.forEach(child => {
      ol.appendChild(renderNote(state, send, child))
    })
    aside.appendChild(ol)
  }

  return aside
}

function renderNoteForm (state, send, { parent, range, selected }) {
  assert(typeof state, 'object')
  assert(!parent || typeof parent === 'string')
  assert(
    !range ||
    (
      typeof range === 'object' &&
      has(range, 'start') &&
      has(range, 'end')
    )
  )
  assert(!selected || typeof selected === 'string')
  assert(typeof send === 'function')

  // <form>
  const form = document.createElement('form')
  form.className = 'noteForm'
  form.addEventListener('submit', event => {
    event.preventDefault()
    event.stopPropagation()
    send('note', { parent, range, text: textarea.value })
  })

  // <textarea>
  const textarea = document.createElement('textarea')
  form.appendChild(textarea)
  textarea.required = true
  textarea.rows = 3
  textarea.autofocus = false

  // <button>
  const button = document.createElement('button')
  form.appendChild(button)
  button.type = 'submit'
  button.appendChild(
    document.createTextNode(
      parent ? 'Add your reply.' : 'Add your note.'
    )
  )

  return form
}
