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
  activity.forEach(function (outerEnvelope) {
    var body = outerEnvelope.innerEnvelope.entry
    var type = body.type
    var li = document.createElement('li')
    var a, brief
    ol.appendChild(li)
    if (type === 'draft') {
      li.appendChild(renderIntro(state, outerEnvelope.logPublicKey, {
        capitalize: true
      }))
      li.appendChild(document.createTextNode(' added '))
      a = document.createElement('a')
      li.appendChild(a)
      a.href = (
        '/projects/' + outerEnvelope.project +
        '/drafts/' + outerEnvelope.digest
      )
      a.appendChild(renderDraftIcon())
      a.appendChild(renderDraftDescription(outerEnvelope, {
        determiner: true
      }))
      li.appendChild(document.createTextNode(' '))
      li.appendChild(renderRelativeTimestamp(outerEnvelope.innerEnvelope.entry.timestamp))
      li.appendChild(document.createTextNode('.'))
    } else if (type === 'intro') {
      li.appendChild(renderIntro(state, outerEnvelope.logPublicKey, {
        capitalize: true
      }))
      li.appendChild(document.createTextNode(
        ' introduced ' +
        (
          outerEnvelope.logPublicKey === state.identity.logPublicKey
            ? 'yourself '
            : 'themself '
        )
      ))
      li.appendChild(renderRelativeTimestamp(outerEnvelope.innerEnvelope.entry.timestamp))
      li.appendChild(document.createTextNode('.'))
    } else if (type === 'mark') {
      brief = state.draftBriefs.find(function (brief) {
        return brief.digest === body.draft
      })
      if (!brief) return
      li.appendChild(renderIntro(state, outerEnvelope.logPublicKey, {
        capitalize: true
      }))
      li.appendChild(document.createTextNode(' put '))
      li.appendChild(renderMarkLink(state, outerEnvelope))
      li.appendChild(document.createTextNode(' on '))
      li.appendChild(renderDraftLink(state, brief))
      li.appendChild(document.createTextNode(' '))
      li.appendChild(renderRelativeTimestamp(outerEnvelope.innerEnvelope.entry.timestamp))
      li.appendChild(document.createTextNode('.'))
    } else if (type === 'note') {
      brief = state.draftBriefs.find(function (brief) {
        return brief.digest === body.draft
      })
      if (!brief) return
      li.appendChild(renderIntro(state, outerEnvelope.logPublicKey, {
        capitalize: true
      }))
      li.appendChild(document.createTextNode(' added a '))
      a = document.createElement('a')
      li.appendChild(a)
      a.href = (
        '/projects/' + outerEnvelope.project +
        '/drafts/' + outerEnvelope.innerEnvelope.entry.draft +
        '#' + outerEnvelope.digest
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
