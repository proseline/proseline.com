var loading = require('./loading')
var cytoscape = require('cytoscape')

module.exports = function (digest, state, send) {
  var main = document.createElement('main')
  if (state.draft && state.draft.digest === digest) {
    var container = document.createElement('div')
    main.appendChild(container)
    var cy = cytoscape({
      fit: true,
      container: container,
      elements: [
        {data: {id: 'a'}},
        {data: {id: 'b'}},
        {data: {id: 'ab', source: 'a', target: 'b'}}
      ],
      layout: {
        name: 'grid',
        rows: 1
      }
    })
  } else {
    main.appendChild(
      loading(function () {
        send('load draft', digest)
      })
    )
  }
  return main
}
