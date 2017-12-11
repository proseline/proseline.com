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
  }
  return main
}
