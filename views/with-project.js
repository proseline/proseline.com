var assert = require('assert')
var renderLoading = require('./loading')

module.exports = function (view) {
  return function (state, send, projectDiscoveryKey) {
    assert.strictEqual(typeof state, 'object')
    assert.strictEqual(typeof send, 'function')
    assert.strictEqual(typeof view, 'function')
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
