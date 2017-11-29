var loading = require('./loading')
var identityLine = require('./partials/identity-line')

module.exports = function (state, send) {
  var main = document.createElement('main')
  main.appendChild(identityLine(state, send))
  if (state.marks === null) {
    main.appendChild(
      loading(function () {
        send('load marks')
      })
    )
  } else {
    main.appendChild(marksList(state.marks))
  }
  main.appendChild(newDraft(send))
  return main
}

function marksList (marks) {
  var section = document.createElement('section')
  var h1 = document.createElement('h1')
  h1.appendChild(document.createTextNode('Your marks'))
  section.appendChild(h1)
  if (marks.length === 0) {
    var p = document.createElement('p')
    p.appendChild(document.createTextNode('You do not have any marks.'))
    section.appendChild(p)
  } else {
    var ul = document.createElement('ul')
    marks.forEach(function (mark) {
      var li = document.createElement('li')
      var a = document.createElement('a')
      a.href = '/marks/' + mark.digest
      a.appendChild(document.createTextNode(mark.payload.name))
      li.appendChild(a)
      ul.appendChild(li)
    })
    section.appendChild(ul)
  }
  return section
}

function newDraft (send) {
  var a = document.createElement('a')
  a.appendChild(document.createTextNode('New Draft'))
  a.href = '/drafts/new'
  return a
}
