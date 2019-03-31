var assert = require('assert')
var renderLoading = require('./loading')

module.exports = function (view) {
  return function (state, send, discoveryKey) {
    assert.strictEqual(typeof state, 'object')
    assert.strictEqual(typeof send, 'function')
    assert.strictEqual(typeof view, 'function')
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
