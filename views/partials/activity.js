const renderDraftDescription = require('./draft-description')
const renderDraftIcon = require('./draft-icon')
const renderDraftLink = require('./draft-link')
const renderIntro = require('./intro')
const renderMarkLink = require('./mark-link')
const renderNoteIcon = require('./note-icon')
const renderRelativeTimestamp = require('./relative-timestamp')

module.exports = (state, activity) => {
  const ol = document.createElement('ol')
  ol.className = 'activity'
  activity.forEach(entry => {
    const type = entry.type
    const li = document.createElement('li')
    let a, brief
    ol.appendChild(li)
    const logPublicKey = entry.envelope.logPublicKey
    if (type === 'draft') {
      li.appendChild(renderIntro(state, logPublicKey, {
        capitalize: true
      }))
      li.appendChild(document.createTextNode(' added '))
      a = document.createElement('a')
      li.appendChild(a)
      a.href = (
        '/projects/' + entry.discoveryKey +
        '/drafts/' + entry.digest
      )
      a.appendChild(renderDraftIcon())
      a.appendChild(renderDraftDescription(entry, {
        determiner: true
      }))
      li.appendChild(document.createTextNode(' '))
      li.appendChild(renderRelativeTimestamp(entry.timestamp))
      li.appendChild(document.createTextNode('.'))
    } else if (type === 'intro') {
      li.appendChild(renderIntro(state, logPublicKey, {
        capitalize: true
      }))
      li.appendChild(document.createTextNode(
        ' introduced ' +
        (
          logPublicKey === state.logKeyPair.publicKey
            ? 'yourself '
            : 'themself '
        )
      ))
      li.appendChild(renderRelativeTimestamp(entry.timestamp))
      li.appendChild(document.createTextNode('.'))
    } else if (type === 'mark') {
      brief = state.draftBriefs.find(brief => {
        return brief.digest === entry.draft
      })
      if (!brief) return
      li.appendChild(renderIntro(state, logPublicKey, {
        capitalize: true
      }))
      li.appendChild(document.createTextNode(' put '))
      li.appendChild(renderMarkLink(state, entry))
      li.appendChild(document.createTextNode(' on '))
      li.appendChild(renderDraftLink(state, brief))
      li.appendChild(document.createTextNode(' '))
      li.appendChild(renderRelativeTimestamp(entry.timestamp))
      li.appendChild(document.createTextNode('.'))
    } else if (type === 'note') {
      brief = state.draftBriefs.find(brief => {
        return brief.digest === entry.draft
      })
      if (!brief) return
      li.appendChild(renderIntro(state, logPublicKey, {
        capitalize: true
      }))
      li.appendChild(document.createTextNode(' added a '))
      a = document.createElement('a')
      li.appendChild(a)
      a.href = (
        '/projects/' + entry.discoveryKey +
        '/drafts/' + entry.draft +
        '#' + entry.digest
      )
      a.appendChild(renderNoteIcon())
      a.appendChild(
        document.createTextNode(entry.parent ? 'reply' : 'note')
      )
      li.appendChild(document.createTextNode(' to '))
      li.appendChild(renderDraftLink(state, brief))
      li.appendChild(document.createTextNode(' '))
      li.appendChild(renderRelativeTimestamp(entry.timestamp))
      li.appendChild(document.createTextNode('.'))
    }
  })
  return ol
}
