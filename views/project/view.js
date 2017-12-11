var byTimestamp = require('../../utilities/by-timestamp')
var loading = require('../loading')
var timestamp = require('../partials/timestamp')

module.exports = function (state, send, discoveryKey) {
  var main = document.createElement('main')
  if (discoveryKey && state.discoveryKey !== discoveryKey) {
    main.appendChild(
      loading(function () {
        send('load project', discoveryKey)
      })
    )
  } else {
    var h1 = document.createElement('h1')
    h1.appendChild(document.createTextNode(state.title))
    main.appendChild(h1)

    main.appendChild(map(state))

    main.appendChild(newDraftSection(state))

    main.appendChild(shareSection(state))
  }
  return main
}

function newDraftSection (state) {
  var section = document.createElement('section')

  var a = document.createElement('a')
  a.href = '/projects/' + state.discoveryKey + '/drafts/new'
  a.appendChild(document.createTextNode('New Draft'))
  section.appendChild(a)

  return section
}

function shareSection (state) {
  var section = document.createElement('section')

  var h2 = document.createElement('h2')
  h2.appendChild(document.createTextNode('Share'))
  section.appendChild(h2)

  var a = document.createElement('a')
  var url = 'https://proseline.com/' + state.secretKey
  a.appendChild(document.createTextNode(url))
  a.setAttribute('href', url)
  section.appendChild(a)

  return section
}

function map (state) {
  var section = document.createElement('section')

  var table = document.createElement('table')
  section.appendChild(table)

  state.projectMarks
    .sort(byTimestamp)
    .reverse()
    .forEach(function (mark) {
      var payload = mark.entry.payload

      var tr = document.createElement('tr')
      table.appendChild(tr)

      var link = document.createElement('td')
      tr.appendChild(link)

      var a = document.createElement('a')
      link.appendChild(a)
      a.href = (
        '/projects/' + state.discoveryKey +
        '/marks/' + mark.publicKey + ':' + payload.identifier
      )
      a.appendChild(document.createTextNode(payload.name))

      var date = document.createElement('td')
      tr.appendChild(date)

      date.appendChild(timestamp(payload.timestamp))
    })

  return section
}
