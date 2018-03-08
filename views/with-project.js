var assert = require('assert')
var renderLoading = require('./loading')

module.exports = function (view) {
  return function (state, send, discoveryKey) {
    assert.equal(typeof state, 'object')
    assert.equal(typeof send, 'function')
    assert.equal(typeof view, 'function')
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
