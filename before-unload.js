var message = exports.message = 'Continue without saving your work?'

var isEnabled = false

exports.enable = function () {
  window.addEventListener('beforeunload', eventHandler)
  isEnabled = true
}

exports.disable = function () {
  window.removeEventListener('beforeunload', eventHandler)
  isEnabled = false
}

exports.isEnabled = function () {
  return isEnabled
}

function eventHandler (event) {
  event.returnValue = message
}
