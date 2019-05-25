var renderDraftDescription = require('./draft-description')
var renderDraftIcon = require('./draft-icon')
var renderDraftLink = require('./draft-link')
var renderIntro = require('./intro')
var renderMarkLink = require('./mark-link')
var renderNoteIcon = require('./note-icon')
var renderRelativeTimestamp = require('./relative-timestamp')

module.exports = function (state, activity) {
  var ol = document.createElement('ol')
  ol.className = 'activity'
  activity.forEach(function (envelope) {
    var body = envelope.innerEnvelope.entry
    var type = body.type
    var li = document.createElement('li')
    var a, brief
    ol.appendChild(li)
    if (type === 'draft') {
      li.appendChild(renderIntro(state, envelope.publicKey, {
        capitalize: true
      }))
      li.appendChild(document.createTextNode(' added '))
      a = document.createElement('a')
      li.appendChild(a)
      a.href = (
        '/projects/' + envelope.entry.project +
        '/drafts/' + envelope.digest
      )
      a.appendChild(renderDraftIcon())
      a.appendChild(renderDraftDescription(envelope, {
        determiner: true
      }))
      li.appendChild(document.createTextNode(' '))
      li.appendChild(renderRelativeTimestamp(envelope.innerEnvelope.entry.timestamp))
      li.appendChild(document.createTextNode('.'))
    } else if (type === 'intro') {
      li.appendChild(renderIntro(state, envelope.publicKey, {
        capitalize: true
      }))
      li.appendChild(document.createTextNode(
        ' introduced ' +
        (
          envelope.publicKey === state.identity.publicKey
            ? 'yourself '
            : 'themself '
        )
      ))
      li.appendChild(renderRelativeTimestamp(envelope.innerEnvelope.entry.timestamp))
      li.appendChild(document.createTextNode('.'))
    } else if (type === 'mark') {
      brief = state.draftBriefs.find(function (brief) {
        return brief.digest === body.draft
      })
      if (!brief) return
      li.appendChild(renderIntro(state, envelope.publicKey, {
        capitalize: true
      }))
      li.appendChild(document.createTextNode(' put '))
      li.appendChild(renderMarkLink(state, envelope))
      li.appendChild(document.createTextNode(' on '))
      li.appendChild(renderDraftLink(state, brief))
      li.appendChild(document.createTextNode(' '))
      li.appendChild(renderRelativeTimestamp(envelope.innerEnvelope.entry.timestamp))
      li.appendChild(document.createTextNode('.'))
    } else if (type === 'note') {
      brief = state.draftBriefs.find(function (brief) {
        return brief.digest === body.draft
      })
      if (!brief) return
      li.appendChild(renderIntro(state, envelope.publicKey, {
        capitalize: true
      }))
      li.appendChild(document.createTextNode(' added a '))
      a = document.createElement('a')
      li.appendChild(a)
      a.href = (
        '/projects/' + envelope.entry.project +
        '/drafts/' + envelope.innerEnvelope.entry.draft +
        '#' + envelope.digest
      )
      a.appendChild(renderNoteIcon())
      a.appendChild(
        document.createTextNode(body.parent ? 'reply' : 'note')
      )
      li.appendChild(document.createTextNode(' to '))
      li.appendChild(renderDraftLink(state, brief))
      li.appendChild(document.createTextNode(' '))
      li.appendChild(renderRelativeTimestamp(body.timestamp))
      li.appendChild(document.createTextNode('.'))
    }
  })
  return ol
}
