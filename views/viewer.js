var commonmark = require('commonmark')
var expandingTextArea = require('./partials/expanding-textarea')
var loading = require('./loading')
var renderDraftHeader = require('./partials/draft-header')
var renderIntro = require('./partials/intro')
var renderMark = require('./partials/mark')
var renderRefreshNotice = require('./partials/refresh-notice')
var renderTimestamp = require('./partials/timestamp')

module.exports = function (state, send, discoveryKey, digest) {
  var main = document.createElement('main')
  if (discoveryKey && state.discoveryKey !== discoveryKey) {
    main.appendChild(
      loading(function () {
        send('load project', discoveryKey)
      })
    )
  } else if (state.draft && state.draft.digest === digest) {
    if (state.changed) {
      main.appendChild(renderRefreshNotice(function () {
        send('load project', discoveryKey)
      }))
    }
    main.appendChild(renderDraftHeader(state))
    main.appendChild(author(state))
    main.appendChild(marks(state, send))
    if (state.draft.message.body.parents.length !== 0) {
      main.appendChild(parents(state, send))
    }
    if (state.children.length !== 0) {
      main.appendChild(children(state, send))
    }
    main.appendChild(markDraft(send))
    main.appendChild(newDraft(state, send))
    main.appendChild(download(send))
    main.appendChild(renderText(state))
    main.appendChild(notes(state, send))
  } else {
    main.appendChild(
      loading(function () {
        send('load draft', {
          discoveryKey: discoveryKey,
          digest: digest
        })
      })
    )
  }
  return main
}

function author (state) {
  var p = document.createElement('p')
  p.className = 'byline'
  p.appendChild(renderIntro(state, state.draft.publicKey))
  p.appendChild(document.createTextNode(' saved this draft on '))
  p.appendChild(dateline(state.draft))
  p.appendChild(document.createTextNode('.'))
  return p
}

function dateline (draft) {
  return renderTimestamp(draft.message.body.timestamp)
}

function marks (state, send) {
  // <ul>
  var ul = document.createElement('ul')
  ul.className = 'marks'
  state.marks.forEach(function (mark) {
    var li = document.createElement('li')
    li.appendChild(renderMark(mark, state, send))
    ul.appendChild(li)
  })
  var formLI = document.createElement('li')
  ul.appendChild(formLI)
  return ul
}

function parents (state, send) {
  var section = document.createElement('section')
  var h2 = document.createElement('h2')
  h2.appendChild(document.createTextNode('Parents'))
  section.appendChild(h2)
  var parents = state.parents
  var ul = document.createElement('ul')
  parents.forEach(function (parent, index) {
    var li = document.createElement('li')
    li.id = 'parent-' + parent.digest
    // <a>
    var a = document.createElement('a')
    a.href = '/drafts/' + parent.digest
    a.appendChild(renderIntro(state, parent.publicKey))
    a.appendChild(document.createTextNode(' on '))
    a.appendChild(renderTimestamp(parent.message.body.timestamp))
    li.appendChild(a)
    // Comparison Button
    var button = document.createElement('button')
    if (
      state.diff &&
      state.diff.source === 'parents' &&
      state.diff.index === index
    ) {
      button.id = 'stopDiffing'
      button.appendChild(document.createTextNode('Stop Comparing'))
      button.addEventListener('click', function () {
        send('stop diffing')
      })
    } else {
      button.id = 'diff' + parent.digest
      button.appendChild(document.createTextNode('Compare'))
      button.addEventListener('click', function () {
        send('diff', {
          source: 'parents',
          index: index
        })
      })
    }
    li.appendChild(button)
    ul.appendChild(li)
  })
  section.appendChild(ul)
  return section
}

function children (state, send) {
  var section = document.createElement('section')
  var h2 = document.createElement('h2')
  h2.appendChild(document.createTextNode('Children'))
  section.appendChild(h2)
  var children = state.children
  var ul = document.createElement('ul')
  children.forEach(function (child, index) {
    var li = document.createElement('li')
    li.id = 'child-' + child.digest
    // <a>
    var a = document.createElement('a')
    a.href = '/drafts/' + child.digest
    a.appendChild(renderIntro(state, child.publicKey))
    a.appendChild(document.createTextNode(' on '))
    a.appendChild(renderTimestamp(child.message.body.timestamp))
    li.appendChild(a)
    // Comparison Button
    var button = document.createElement('button')
    if (
      state.diff &&
      state.diff.source === 'children' &&
      state.diff.index === index
    ) {
      button.id = 'stopDiffing'
      button.appendChild(document.createTextNode('Stop Comparing'))
      button.addEventListener('click', function () {
        send('stop diffing')
      })
    } else {
      button.id = 'diff' + child.digest
      button.appendChild(document.createTextNode('Compare'))
      button.addEventListener('click', function () {
        send('diff', {
          source: 'children',
          index: index
        })
      })
    }
    li.appendChild(button)
    ul.appendChild(li)
  })
  section.appendChild(ul)
  return section
}

function renderText (state) {
  var draft = state.draft
  var article = document.createElement('article')
  article.className = 'draftText'
  if (state.diff) {
    state.diff.changes.forEach(function (change) {
      var p = document.createElement('p')
      var text = document.createTextNode(change.value)
      if (change.added) {
        var ins = document.createElement('ins')
        ins.appendChild(text)
        p.appendChild(ins)
      } else if (change.removed) {
        var del = document.createElement('del')
        del.appendChild(text)
        p.appendChild(del)
      } else {
        p.appendChild(text)
      }
      article.appendChild(p)
    })
  } else {
    article.appendChild(renderMarkdown(draft.message.body.text))
  }
  return article
}

function renderMarkdown (markdown) {
  var reader = new commonmark.Parser()
  var writer = new commonmark.HtmlRenderer({
    smart: true,
    safe: true
  })
  var parsed = reader.parse(markdown)
  var rendered = writer.render(parsed)
  var template = document.createElement('template')
  template.innerHTML = rendered
  return template.content.firstChild
}

function markDraft (send) {
  var button = document.createElement('button')
  button.addEventListener('click', function (event) {
    var marker = window.prompt('Name the marker:')
    if (marker === null) return
    if (marker.length === 0) return
    send('mark', marker)
  })
  button.appendChild(document.createTextNode('Put a marker on this draft.'))
  return button
}

function newDraft (state, send) {
  var a = document.createElement('a')
  a.className = 'button'
  a.href = (
    '/projects/' + state.discoveryKey +
    '/drafts/new/' + state.draft.digest
  )
  a.appendChild(document.createTextNode('Start a new draft based on this one.'))
  return a
}

function download (send) {
  var a = document.createElement('a')
  a.addEventListener('click', function () {
    send('download')
  })
  a.className = 'button'
  a.appendChild(document.createTextNode('Download this draft.'))
  return a
}

function notes (state, send) {
  var section = document.createElement('section')
  var h2 = document.createElement('h2')
  h2.appendChild(document.createTextNode('Notes'))
  section.appendChild(h2)
  section.appendChild(notesList(state, send))
  return section
}

function notesList (state, send) {
  var notes = state.notesTree
  var replyTo = state.replyTo
  var ol = document.createElement('ol')
  ol.className = 'notesList'
  notes.forEach(function (note) {
    ol.appendChild(noteLI(state, note, send))
  })
  var directLI = document.createElement('li')
  if (replyTo) {
    var button = document.createElement('button')
    button.appendChild(document.createTextNode('Add a note to this draft.'))
    button.addEventListener('click', function () {
      send('reply to', null)
    })
    directLI.appendChild(button)
  } else {
    directLI.appendChild(noteForm(null, send))
  }
  ol.appendChild(directLI)
  return ol
}

function noteLI (state, note, send) {
  var li = document.createElement('li')
  li.id = 'note-' + note.digest
  var replyTo = state.replyTo
  // <blockquote>
  var blockquote = document.createElement('blockquote')
  blockquote.className = 'note'
  blockquote.appendChild(renderMarkdown(note.message.body.text))
  li.appendChild(blockquote)
  // <p>
  var p = document.createElement('p')
  p.className = 'byline'
  p.appendChild(renderIntro(state, note.publicKey))
  p.appendChild(document.createTextNode(' on '))
  p.appendChild(renderTimestamp(note.message.body.timestamp))
  li.appendChild(p)
  if (replyTo === note.digest) {
    li.appendChild(noteForm(note.digest, send))
  } else {
    // <button>
    var button = document.createElement('button')
    button.addEventListener('click', function () {
      send('reply to', note.digest)
    })
    button.appendChild(document.createTextNode('Reply to this note.'))
    li.appendChild(button)
  }
  if (note.children.length !== 0) {
    var ol = document.createElement('ol')
    note.children.forEach(function (child) {
      ol.appendChild(noteLI(state, child, send))
    })
    li.appendChild(ol)
  }
  return li
}

function noteForm (parent, send) {
  var form = document.createElement('form')
  form.className = 'noteForm'
  form.addEventListener('submit', function (event) {
    event.preventDefault()
    event.stopPropagation()
    send('note', {
      parent: parent,
      text: textarea.value
    })
  })
  // <textarea>
  var textarea = expandingTextArea()
  textarea.required = true
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
