var renderDraftIcon = require('./draft-icon')
var renderIntro = require('./intro')
var renderIntroIcon = require('./intro-icon')
var renderMarkIcon = require('./mark-icon')
var renderNoteIcon = require('./note-icon')
var renderRelativeTimestamp = require('./relative-timestamp')

module.exports = function (state, activity) {
  var ol = document.createElement('ol')
  ol.className = 'activity'
  activity.forEach(function (envelope) {
    var body = envelope.message.body
    var type = body.type
    var li = document.createElement('li')
    var a
    ol.appendChild(li)
    if (type === 'draft') {
      li.appendChild(renderDraftIcon())
      li.appendChild(renderIntro(state, envelope.publicKey))
      li.appendChild(document.createTextNode(' added '))
      a = document.createElement('a')
      li.appendChild(a)
      a.href = (
        '/projects/' + envelope.message.project +
        '/drafts/' + envelope.digest
      )
      a.appendChild(document.createTextNode('a draft'))
      li.appendChild(document.createTextNode(' '))
      li.appendChild(renderRelativeTimestamp(envelope.message.body.timestamp))
      li.appendChild(document.createTextNode('.'))
    } else if (type === 'intro') {
      li.appendChild(renderIntroIcon())
      li.appendChild(renderIntro(state, envelope.publicKey))
      li.appendChild(document.createTextNode(
        ' introduced ' +
        (
          envelope.publicKey === state.identity.publicKey
            ? 'yourself '
            : 'themself '
        )
      ))
      li.appendChild(renderRelativeTimestamp(envelope.message.body.timestamp))
      li.appendChild(document.createTextNode('.'))
    } else if (type === 'mark') {
      li.appendChild(renderMarkIcon())
      li.appendChild(renderIntro(state, envelope.publicKey))
      li.appendChild(document.createTextNode(' put the mark '))
      li.appendChild(document.createTextNode('“' + body.name + '”'))
      li.appendChild(document.createTextNode(' on '))
      li.appendChild(renderDraftLink(state.discoveryKey, body.draft))
      li.appendChild(document.createTextNode(' '))
      li.appendChild(renderRelativeTimestamp(envelope.message.body.timestamp))
      li.appendChild(document.createTextNode('.'))
    } else if (type === 'note') {
      li.appendChild(renderNoteIcon())
      li.appendChild(renderIntro(state, envelope.publicKey))
      li.appendChild(document.createTextNode(' '))
      a = document.createElement('a')
      li.appendChild(a)
      a.href = (
        '/projects/' + envelope.message.project +
        '/drafts/' + envelope.message.body.draft +
        '#' + envelope.digest
      )
      a.appendChild(
        document.createTextNode(
          body.parent
            ? 'replied to a note'
            : 'added a note'
        )
      )
      li.appendChild(document.createTextNode(' to '))
      li.appendChild(renderDraftLink(state.discoveryKey, body.draft))
      li.appendChild(document.createTextNode(' '))
      li.appendChild(renderRelativeTimestamp(body.timestamp))
      li.appendChild(document.createTextNode('.'))
    }
  })
  return ol
}

function renderDraftLink (discoveryKey, digest) {
  var a = document.createElement('a')
  a.href = (
    '/projects/' + discoveryKey +
    '/drafts/' + digest
  )
  a.appendChild(document.createTextNode('this draft'))
  return a
}
