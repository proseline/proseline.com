var assert = require('nanoassert')
var renderLoading = require('./loading')

module.exports = function (view) {
  return function (state, send, discoveryKey) {
    assert(typeof state === 'object')
    assert(typeof send === 'function')
    assert(typeof view === 'function')
    if (discoveryKey && state.discoveryKey !== discoveryKey) {
      var main = document.createElement('main')
      main.appendChild(
        renderLoading(function () {
          send('load project', discoveryKey)
        }, 'Loading project…')
      )
      return main
    } else {
      return view.apply(null, arguments)
    }
  }
}
