const message = exports.message = 'Continue without saving your work?'

let isEnabled = false

exports.enable = () => {
  window.addEventListener('beforeunload', eventHandler)
  isEnabled = true
}

exports.disable = () => {
  window.removeEventListener('beforeunload', eventHandler)
  isEnabled = false
}

exports.isEnabled = () => {
  return isEnabled
}

function eventHandler (event) {
  event.returnValue = message
}
