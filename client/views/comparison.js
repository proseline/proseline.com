/* globals Text */
const diff = require('rfc6902-json-diff')
const pmModel = require('prosemirror-model')
const renderDraftHeader = require('./partials/draft-header')
const renderLoading = require('./loading')
const withProject = require('./with-project')

const DOMSerializer = pmModel.DOMSerializer
const schema = require('../editor/schema')

module.exports = withProject((state, send, discoveryKey, drafts) => {
  state.route = 'comparison'
  const digest = drafts[0]
  const comparing = drafts[1]
  const main = document.createElement('main')
  if (
    !state.draft ||
    state.draft.digest !== digest ||
    !state.comparing ||
    state.comparing.digest !== comparing
  ) {
    main.appendChild(
      renderLoading(function () {
        send('load draft', {
          discoveryKey,
          digest,
          comparing
        })
      })
    )
  } else {
    main.appendChild(renderDraftHeader(state))

    const article = document.createElement('article')
    main.appendChild(article)

    const serializer = DOMSerializer.fromSchema(schema)
    const doc = schema.nodeFromJSON(state.draft.text)
    const rendered = serializer.serializeFragment(doc.content)
    article.appendChild(rendered)

    const patch = diff(
      state.draft.text,
      state.comparing.text
    )
    patch.forEach(element => {
      const type = element.op
      if (type === 'replace') {
        if (element.path.endsWith('/text')) {
          const descended = descend(article, element.path)
          descended.parentNode.insertBefore(
            (function () {
              const del = document.createElement('del')
              del.appendChild(document.createTextNode(element.value))
              return del
            })(),
            descended
          )
          descended.parentNode.replaceChild(
            (function () {
              const ins = document.createElement('ins')
              if (descended instanceof Text) {
                ins.appendChild(document.createTextNode(descended.wholeText))
              } else {
                const childNodes = descended.childNodes
                for (let index = 0; index < childNodes.length; index++) {
                  const child = childNodes[index]
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
  const split = path.split('/').slice(1)
  let offset = 0
  while (split[offset] === 'content') {
    const childIndex = parseInt(split[offset + 1])
    node = node.childNodes[childIndex]
    offset += 2
  }
  return node
}
