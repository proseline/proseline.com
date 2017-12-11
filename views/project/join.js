var loading = require('../loading')

module.exports = function (state, send, secretKey) {
  var main = document.createElement('main')
  main.appendChild(
    loading(function () {
      send('join project', secretKey)
    })
  )
  return main
}
