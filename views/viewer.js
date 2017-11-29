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
  section.appendChild(byline(state))
  section.appendChild(dateline(state.draft))
  return section
}

function byline (state) {
  var intro = state.intro
  var draft = state.draft
  var p = document.createElement('p')
  if (intro && intro.public === draft.public) {
    p.appendChild(
      document.createTextNode(
        intro.payload.name + ' on ' + intro.payload.device
      )
    )
  } else {
    var code = document.createElement('code')
    code.appendChild(document.createTextNode(draft.public))
    p.appendChild(code)
  }
  return p
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
    state.diff.tuples.forEach(function (tuple) {
      var element
      var operation = tuple[0]
      if (operation === 0) {
        element = document.createTextNode(tuple[1])
      } else {
        if (operation === -1) {
          element = document.createElement('del')
        } else if (operation === 1) {
          element = document.createElement('ins')
        }
        element.appendChild(document.createTextNode(tuple[1]))
      }
      article.appendChild(element)
    })
  } else {
    draft.payload.text
      .split('\n')
      .forEach(function (line, index) {
        var span = document.createElement('span')
        span.appendChild(document.createTextNode(line))
        article.appendChild(span)
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
