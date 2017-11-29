/* global DOMParser */

var commonmark = require('commonmark')

var loading = require('./loading')

module.exports = function (digest, state, send) {
  var main = document.createElement('main')
  if (state.draft && state.draft.digest === digest) {
    var draft = state.draft
    main.appendChild(dateline(draft))
    main.appendChild(renderText(draft))
    main.appendChild(markForm(send))
  } else {
    main.appendChild(
      loading(function () {
        send('load draft', digest)
      })
    )
  }
  return main
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
  var body = new DOMParser()
    .parseFromString(rendered, 'text/html')
    .body
  while (body.hasChildNodes()) {
    article.appendChild(body.firstChild)
  }
  return article
}

function dateline (draft) {
  var p = document.createElement('p')
  p.appendChild(document.createTextNode(draft.payload.timestamp))
  return p
}

function markForm (send) {
  var form = document.createElement('form')
  form.addEventListener('submit', function (event) {
    event.preventDefault()
    event.stopPropagation()
    return false
  })
  // Name
  var name = document.createElement('input')
  name.type = 'text'
  name.required = true
  form.appendChild(name)
  // Button
  var button = document.createElement('button')
  button.appendChild(document.createTextNode('Mark'))
  button.addEventListener('click', function () {
    send('mark', name.value)
  })
  return form
}
