module.exports = function (delta) {
  var currentBlock = block()
  var returned = [currentBlock]
  delta.forEach(function (operation) {
    var insert = operation.insert
    var attributes = operation.attributes
    if (insert === '\n') {
      if (attributes.header) {
        currentBlock.type = 'h' + attributes.header
      } else if (attributes.quote) {
        currentBlock.type = 'blockquote'
      } else if (attributes['code-block']) {
        currentBlock.type = 'pre'
      } else if (attributes.list) {
        currentBlock.type = 'li'
        currentBlock.subtype = attributes.list
      }
      currentBlock = block()
      returned.push(block())
    } else if (typeof insert === 'string') {
    } else {
      //TODO
    }
  })
  // TODO: Wrap <li>s in <ol>s and <ul>s.
  return returned
}

function block () {
  return {
    type: 'paragraph',
    content: []
  }
}
