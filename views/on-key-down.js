var beforeUnload = require('../before-unload')

module.exports = function (editor, parents, projectDiscoveryKey, send) {
  return function (event) {
    if (event.ctrlKey || (navigator.platform.match('Mac') && event.metaKey)) {
      // Ctrl + S
      if (event.keyCode === 83 && beforeUnload.isEnabled()) {
        event.preventDefault()
        send('save', {
          projectDiscoveryKey,
          text: editor.state.doc.toJSON(),
          parents: parents
        })
      }
    }
  }
}
