const beforeUnload = require('../before-unload')

module.exports = (editor, parents, discoveryKey, send) => {
  return event => {
    if (event.ctrlKey || (navigator.platform.match('Mac') && event.metaKey)) {
      // Ctrl + S
      if (event.keyCode === 83 && beforeUnload.isEnabled()) {
        event.preventDefault()
        send('save', {
          discoveryKey,
          text: editor.state.doc.toJSON(),
          parents: parents
        })
      }
    }
  }
}
