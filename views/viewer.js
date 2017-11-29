var loading = require('./loading')
var renderMark = require('./partials/mark')
var renderTimestamp = require('./partials/timestamp')

module.exports = function (digest, state, send) {
  var main = document.createElement('main')
  if (state.draft && state.draft.digest === digest) {
    main.appendChild(author(state))
    main.appendChild(marks(state, send))
    main.appendChild(parents(state, send))
    main.appendChild(children(state, send))
    main.appendChild(renderText(state))
    main.appendChild(newDraftButton(state, send))
    main.appendChild(notes(state, send))
  } else {
    main.appendChild(
      loading(function () {
        send('load draft', digest)
      })
    )
  }
  return main
}

function author (state) {
  var section = document.createElement('section')
  var h2 = document.createElement('h2')
  h2.appendChild(document.createTextNode('Author'))
  section.appendChild(h2)
  section.appendChild(byline(state, state.draft.public, state.intro))
  section.appendChild(dateline(state.draft))
  return section
}

function byline (state, publicKey, intro) {
  var returned
  if (state.identity.publicKey === publicKey) {
    returned = document.createElement('span')
    returned.appendChild(document.createTextNode('You'))
  } else if (intro) {
    returned = document.createElement('span')
    returned.appendChild(
      document.createTextNode(
        intro.payload.name + ' on ' + intro.payload.device
      )
    )
  } else {
    returned = document.createElement('code')
    returned.appendChild(document.createTextNode(publicKey))
  }
  return returned
}

function dateline (draft) {
  var p = document.createElement('p')
  p.appendChild(renderTimestamp(draft.payload.timestamp))
  return p
}

function marks (state, send) {
  var section = document.createElement('section')
  // <h2>
  var h2 = document.createElement('h2')
  h2.appendChild(document.createTextNode('Marks'))
  section.appendChild(h2)
  // <ul>
  var ul = document.createElement('ul')
  state.marks.forEach(function (mark) {
    var li = document.createElement('li')
    li.appendChild(renderMark(mark, state, send))
    ul.appendChild(li)
  })
  var formLI = document.createElement('li')
  formLI.appendChild(markForm(send))
  ul.appendChild(formLI)
  section.appendChild(ul)
  return section
}

function parents (state) {
  var section = document.createElement('section')
  var h2 = document.createElement('h2')
  h2.appendChild(document.createTextNode('Parents'))
  section.appendChild(h2)
  var parents = state.draft.payload.parents
  if (parents.length === 0) {
    var p = document.createElement('p')
    p.appendChild(document.createTextNode('None.'))
    section.appendChild(p)
  } else {
    var ul = document.createElement('ul')
    parents.forEach(function (digest) {
      var li = document.createElement('li')
      var a = document.createElement('a')
      a.href = '/drafts/' + digest
      a.appendChild(document.createTextNode('parent'))
      li.appendChild(a)
      ul.appendChild(li)
    })
    section.appendChild(ul)
  }
  return section
}

function children (state, send) {
  var section = document.createElement('section')
  var h2 = document.createElement('h2')
  h2.appendChild(document.createTextNode('Children'))
  section.appendChild(h2)
  var children = state.children
  if (children.length === 0) {
    var p = document.createElement('p')
    p.appendChild(document.createTextNode('None.'))
    section.appendChild(p)
  } else {
    var ul = document.createElement('ul')
    children.forEach(function (child, index) {
      var li = document.createElement('li')
      // <a>
      var a = document.createElement('a')
      a.href = '/drafts/' + child.digest
      a.appendChild(document.createTextNode('child'))
      li.appendChild(a)
      // Comparison Button
      if (!state.diff || state.diff.index !== index) {
        var button = document.createElement('button')
        button.appendChild(document.createTextNode('Compare'))
        button.addEventListener('click', function () {
          send('diff', index)
        })
        li.appendChild(button)
      }
      ul.appendChild(li)
    })
    section.appendChild(ul)
  }
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
    draft.payload.text
      .split('\n')
      .forEach(function (line, index) {
        var p = document.createElement('p')
        p.appendChild(document.createTextNode(line))
        article.appendChild(p)
      })
  }
  return article
}

function markForm (send) {
  var form = document.createElement('form')
  form.addEventListener('submit', function (event) {
    event.preventDefault()
    event.stopPropagation()
    send('mark', name.value)
  })
  // Name
  var name = document.createElement('input')
  name.type = 'text'
  name.required = true
  form.appendChild(name)
  // Button
  var button = document.createElement('button')
  button.appendChild(document.createTextNode('Mark'))
  form.appendChild(button)
  return form
}

function newDraftButton (state, send) {
  var div = document.createElement('div')
  var a = document.createElement('a')
  a.href = '/drafts/new/' + state.draft.digest
  a.appendChild(document.createTextNode('New Draft'))
  div.appendChild(a)
  return div
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
  var notes = state.notes
  var replyTo = state.replyTo
  var ol = document.createElement('ol')
  ol.className = 'notesList'
  notes.forEach(function (note) {
    ol.appendChild(noteLI(state, note, send))
  })
  var directLI = document.createElement('li')
  if (replyTo) {
    var button = document.createElement('button')
    button.appendChild(document.createTextNode('Add a Direct Note'))
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
  blockquote.appendChild(
    document.createTextNode(note.payload.text)
  )
  li.appendChild(blockquote)
  // <p>
  var p = document.createElement('p')
  p.className = 'byline'
  var intro = state.noteIntros[note.public]
  p.appendChild(byline(state, note.public, intro))
  p.appendChild(document.createTextNode(' — '))
  p.appendChild(renderTimestamp(note.payload.timestamp))
  li.appendChild(p)
  if (replyTo === note.digest) {
    li.appendChild(noteForm(note.digest, send))
  } else {
    // <button>
    var button = document.createElement('button')
    button.addEventListener('click', function () {
      send('reply to', note.digest)
    })
    button.appendChild(document.createTextNode('Reply'))
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
  var textarea = document.createElement('textarea')
  textarea.required = true
  form.appendChild(textarea)
  // <button>
  var button = document.createElement('button')
  button.type = 'submit'
  button.appendChild(
    document.createTextNode(parent ? 'Reply' : 'Add a Note')
  )
  form.appendChild(button)
  return form
}
