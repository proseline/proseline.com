var assert = require('nanoassert')
var renderLoading = require('./loading')

module.exports = function (view) {
  return function (state, send, projectDiscoveryKey) {
    assert(typeof state === 'object')
    assert(typeof send === 'function')
    assert(typeof view === 'function')
    if (projectDiscoveryKey && state.projectDiscoveryKey !== projectDiscoveryKey) {
      var main = document.createElement('main')
      main.appendChild(
        renderLoading(function () {
          send('load project', projectDiscoveryKey)
        }, 'Loading project…')
      )
      return main
    } else {
      return view.apply(null, arguments)
    }
  }
}
