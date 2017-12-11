var loading = require('../loading')

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
