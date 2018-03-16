/* globals Text */
var diff = require('rfc6902-json-diff')
var pmModel = require('prosemirror-model')
var renderDraftHeader = require('./partials/draft-header')
var renderLoading = require('./loading')
var withProject = require('./with-project')

var DOMSerializer = pmModel.DOMSerializer
var schema = require('../editor/schema')

module.exports = withProject(function (state, send, discoveryKey, drafts) {
  state.route = 'comparison'
  var digest = drafts[0]
  var comparing = drafts[1]
  var main = document.createElement('main')
  if (
    !state.draft ||
    state.draft.digest !== digest ||
    !state.comparing ||
    state.comparing.digest !== comparing
  ) {
    main.appendChild(
      renderLoading(function () {
        send('load draft', {
          discoveryKey: discoveryKey,
          digest,
          comparing
        })
      })
    )
  } else {
    main.appendChild(renderDraftHeader(state))

    var article = document.createElement('article')
    main.appendChild(article)

    var serializer = DOMSerializer.fromSchema(schema)
    var doc = schema.nodeFromJSON(state.draft.message.body.text)
    var rendered = serializer.serializeFragment(doc.content)
    article.appendChild(rendered)

    var patch = diff(
      state.draft.message.body.text,
      state.comparing.message.body.text
    )
    console.log(patch)
    patch.forEach(function (element) {
      var type = element.op
      if (type === 'replace') {
        if (element.path.endsWith('/text')) {
          var descended = descend(article, element.path)
          descended.parentNode.insertBefore(
            (function () {
              var del = document.createElement('del')
              del.appendChild(document.createTextNode(element.value))
              return del
            })(),
            descended
          )
          descended.parentNode.replaceChild(
            (function () {
              var ins = document.createElement('ins')
              if (descended instanceof Text) {
                ins.appendChild(document.createTextNode(descended.wholeText))
              } else {
                var childNodes = descended.childNodes
                for (var index = 0; index < childNodes.length; index++) {
                  var child = childNodes[index]
                  ins.appendChild(child.cloneNode())
                }
              }
              return ins
            })(),
            descended
          )
        }
      }
    })
  }
  return main
})

function descend (node, path) {
  var split = path.split('/').slice(1)
  var offset = 0
  while (split[offset] === 'content') {
    var childIndex = parseInt(split[offset + 1])
    node = node.childNodes[childIndex]
    offset += 2
  }
  return node
}
