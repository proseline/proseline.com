/* global DOMParser */

var commonmark = require('commonmark')

var loading = require('./loading')
var renderMark = require('./partials/mark')
var renderTimestamp = require('./partials/timestamp')

module.exports = function (digest, state, send) {
  var main = document.createElement('main')
  if (state.draft && state.draft.digest === digest) {
    main.appendChild(author(state))
    main.appendChild(marks(state, send))
    main.appendChild(renderText(state.draft))
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
  var intro = state.introduction
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

function renderText (draft) {
  var reader = new commonmark.Parser()
  var writer = new commonmark.HtmlRenderer()
  var parsed = reader.parse(draft.payload.text)
  var rendered = writer.render(parsed, {
    smart: true,
    safe: true
  })
  var article = document.createElement('article')
  article.className = 'draftText'
  var body = new DOMParser()
    .parseFromString(rendered, 'text/html')
    .body
  while (body.hasChildNodes()) {
    article.appendChild(body.firstChild)
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
