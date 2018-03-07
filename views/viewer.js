var assert = require('assert')
var renderDraftHeader = require('./partials/draft-header')
var renderExpandingTextArea = require('./partials/expanding-textarea')
var renderIntro = require('./partials/intro')
var renderLoading = require('./loading')
var renderMark = require('./partials/mark')
var renderNoteIcon = require('./partials/note-icon')
var renderQuoteIcon = require('./partials/quote-icon')
var renderRefreshNotice = require('./partials/refresh-notice')
var renderSection = require('./partials/section')
var renderTimestamp = require('./partials/timestamp')

module.exports = function (state, send, discoveryKey, digest) {
  state.route = 'viewer'
  var main = document.createElement('main')
  if (discoveryKey && state.discoveryKey !== discoveryKey) {
    main.appendChild(
      renderLoading(function () {
        send('load project', discoveryKey)
      })
    )
  } else if (state.draft && state.draft.digest === digest) {
    if (state.changed) {
      main.appendChild(renderRefreshNotice(function () {
        send('load project', discoveryKey)
      }))
    }
    main.appendChild(renderDraftHeader(state))
    main.appendChild(renderDraft(state, send))
    main.appendChild(renderNotes(state, send))
    main.appendChild(renderMarkDraft(state, send))
    main.appendChild(renderNewDraft(state, send))
    main.appendChild(renderDownload(send))
    main.appendChild(renderHistory(state, send))
  } else {
    main.appendChild(
      renderLoading(function () {
        send('load draft', {
          discoveryKey: discoveryKey,
          digest: digest
        })
      })
    )
  }
  return main
}

function renderHistory (state, send) {
  var section = renderSection('History')
  section.appendChild(renderAuthor(state))
  if (state.draft.message.body.parents.length !== 0) {
    section.appendChild(renderParents(state, send))
  }
  if (state.children.length !== 0) {
    section.appendChild(renderChildren(state, send))
  }
  section.appendChild(renderMarks(state, send))
  return section
}

function renderAuthor (state) {
  var p = document.createElement('p')
  p.className = 'byline'
  p.appendChild(renderIntro(state, state.draft.publicKey))
  p.appendChild(document.createTextNode(' saved this draft on '))
  p.appendChild(renderDateline(state.draft))
  p.appendChild(document.createTextNode('.'))
  return p
}

function renderDateline (draft) {
  return renderTimestamp(draft.message.body.timestamp)
}

function renderMarks (state, send) {
  var fragment = document.createDocumentFragment()
  state.marks
    .sort(function (a, b) {
      return a.message.body.timestamp.localeCompare(
        b.message.body.timestamp
      )
    })
    .forEach(function (mark) {
      fragment.appendChild(renderMark(mark, state, send))
    })
  return fragment
}

function renderParents (state, send) {
  var parents = state.parents
  var p = document.createElement('p')
  p.appendChild(renderIntro(state, state.draft.publicKey))
  p.appendChild(
    document.createTextNode(' started this draft from ')
  )
  // TODO: Display multiple parents.
  parents.forEach(function (parent, index) {
    var a = document.createElement('a')
    p.appendChild(a)
    a.href = (
      '/projects/' + state.discoveryKey +
      '/drafts/' + parent.digest
    )
    a.appendChild(renderIntro(state, parent.publicKey, true))
    a.appendChild(document.createTextNode(' on '))
    a.appendChild(renderTimestamp(parent.message.body.timestamp))
    p.appendChild(document.createTextNode(' '))
    var button = document.createElement('button')
    p.appendChild(button)
    if (
      state.diff &&
      state.diff.source === 'parents' &&
      state.diff.index === index
    ) {
      button.id = 'stopDiffing'
      button.appendChild(document.createTextNode('Stop Comparing'))
      button.addEventListener('click', function () {
        send('stop diffing')
      })
    } else {
      button.id = 'diff' + parent.digest
      button.appendChild(document.createTextNode('Compare'))
      button.addEventListener('click', function () {
        send('diff', {
          source: 'parents',
          index: index
        })
      })
    }
  })
  p.appendChild(document.createTextNode('. '))
  return p
}

function renderChildren (state, send) {
  var children = state.children
  var p = document.createElement('p')
  var length = children.length
  var lastIndex = length - 1
  children.forEach(function (child, index) {
    var a = document.createElement('a')
    p.appendChild(a)
    a.href = (
      '/projects/' + state.discoveryKey +
      '/drafts/' + child.digest
    )
    a.appendChild(renderIntro(state, child.publicKey, true))
    a.appendChild(document.createTextNode(' on '))
    a.appendChild(renderTimestamp(child.message.body.timestamp))
    p.appendChild(document.createTextNode(' '))
    var button = document.createElement('button')
    p.appendChild(button)
    if (
      state.diff &&
      state.diff.source === 'children' &&
      state.diff.index === index
    ) {
      button.id = 'stopDiffing'
      button.appendChild(document.createTextNode('Stop Comparing'))
      button.addEventListener('click', function () {
        send('stop diffing')
      })
    } else {
      button.id = 'diff' + child.digest
      button.appendChild(document.createTextNode('Compare'))
      button.addEventListener('click', function () {
        send('diff', {
          source: 'children',
          index: index
        })
      })
    }
    if (length > 1) {
      if (index === lastIndex - 1) {
        p.appendChild(document.createTextNode(', and '))
      } else {
        p.appendChild(document.createTextNode(', '))
      }
    }
  })
  p.appendChild(document.createTextNode(
    ' started from this draft.'
  ))
  return p
}

function renderDraft (state, send) {
  var draft = state.draft
  var article = document.createElement('article')
  article.className = 'draftText renderedText'
  if (state.diff) {
    state.diff.changes.forEach(function (change) {
      var p = document.createElement('p')
      var text = document.createTextNode(change.value)
      if (change.added) {
        var ins = document.createElement('ins')
        ins.appendChild(text)
        p.appendChild(ins)
      } else if (change.removed) {
        var del = document.createElement('del')
        del.appendChild(text)
        p.appendChild(del)
      } else {
        p.appendChild(text)
      }
      article.appendChild(p)
    })
  } else {
    var inlineNotes = state.notesTree.filter(function (note) {
      return note.message.body.range
    })
    article.appendChild(
      renderText(draft.message.body.text, inlineNotes, state.textSelection)
    )
    Array.from(article.children).forEach(function (child) {
      var childRange = {
        start: parseInt(child.dataset.start),
        end: parseInt(child.dataset.end)
      }
      // Render existing notes.
      var notesHere = inlineNotes.filter(function (note) {
        return endsInRange(note.message.body.range.end, childRange)
      })
      if (notesHere.length !== 0) {
        notesHere.reverse().forEach(function (note) {
          insertAfter(renderInlineNotesList(state, send, note))
        })
      }
      // Render the new-note form.
      var textSelection = state.textSelection
      if (textSelection) {
        if (endsInRange(textSelection.end, childRange)) {
          var aside = document.createElement('aside')
          insertAfter(aside)
          aside.appendChild(renderNoteForm(
            state, null, state.textSelection, send
          ))
        }
      }
      function insertAfter (sibling) {
        child.parentNode.insertBefore(sibling, child.nextSibling)
      }
    })
  }
  return article

  // TODO: Deduplicate renderInlineNotesList and renderNotesList.

  function renderInlineNotesList (state, send, parent) {
    var aside = document.createElement('aside')
    aside.className = 'note'

    var ol = document.createElement('ol')
    aside.appendChild(ol)
    ol.className = 'notesList'
    ol.appendChild(renderNote(state, parent, send))

    return aside
  }

  function endsInRange (position, range) {
    return position >= range.start && position <= range.end
  }
}

var SEPARATOR = '\n\n'

function renderText (text, notes, textSelection) {
  notes = notes || []
  var fragment = document.createDocumentFragment()
  var offset = 0
  text
    .split(SEPARATOR)
    .forEach(function (line) {
      // Create <p>.
      var p = document.createElement('p')
      fragment.appendChild(p)
      p.dataset.start = offset
      p.dataset.end = offset + line.length

      var items = []
      line
        .split('')
        .forEach(function (character, relativeIndex) {
          var last = items.length ? items[items.length - 1] : false
          var absoluteIndex = relativeIndex + offset
          var inHighlighted = notes
            .map(function (note) {
              return note.message.body.range
            })
            .concat(textSelection || [])
            .some(function (range) {
              return (
                range.start <= absoluteIndex &&
                absoluteIndex < range.end
              )
            })
          if (inHighlighted) {
            if (last && last.marked) {
              last.string = last.string + character
              last.end = absoluteIndex
            } else {
              items.push({
                string: character,
                marked: true,
                start: absoluteIndex
              })
            }
          } else {
            if (last && !last.marked) {
              last.string = last.string + character
              last.end = absoluteIndex
            } else {
              items.push({
                string: character,
                marked: false,
                start: absoluteIndex
              })
            }
          }
        })
      items.forEach(function (item) {
        var child = document.createElement(
          item.marked ? 'mark' : 'span'
        )
        child.appendChild(document.createTextNode(item.string))
        child.dataset.start = item.start
        child.dataset.end = item.end
        p.appendChild(child)
      })

      offset += line.length + SEPARATOR.length
    })
  return fragment
}

function renderMarkDraft (state, send) {
  var form = document.createElement('form')
  form.id = 'markDraft'
  form.addEventListener('submit', function (event) {
    event.preventDefault()
    event.stopPropagation()
    var name = input.value
    var continuing = marksICanMove.find(function (mark) {
      return mark.message.body.name === name
    })
    send('mark', {
      name: name,
      identifier: continuing
        ? continuing.message.body.identifier
        : null
    })
  })

  var input = document.createElement('input')
  input.required = true
  form.appendChild(input)

  var marksICanMove = state.projectMarks.filter(function (mark) {
    return (
      mark.publicKey === state.identity.publicKey &&
      mark.message.body.draft !== state.draft.digest
    )
  })
  if (marksICanMove.length !== 0) {
    var datalist = document.createElement('datalist')
    form.appendChild(datalist)
    datalist.id = 'marksICanMove'
    input.setAttribute('list', datalist.id)
    marksICanMove.forEach(function (mark) {
      var option = document.createElement('option')
      datalist.appendChild(option)
      option.value = mark.message.body.name
    })
  }

  var button = document.createElement('button')
  button.type = 'submit'
  button.appendChild(document.createTextNode('Put a marker on this draft.'))
  form.appendChild(button)

  return form
}

function renderNewDraft (state, send) {
  var a = document.createElement('a')
  a.className = 'button'
  a.href = (
    '/projects/' + state.discoveryKey +
    '/drafts/new/' + state.draft.digest
  )
  a.appendChild(document.createTextNode('Start a new draft based on this one.'))
  return a
}

function renderDownload (send) {
  var a = document.createElement('a')
  a.addEventListener('click', function () {
    send('download')
  })
  a.className = 'button'
  a.appendChild(document.createTextNode('Download this draft.'))
  return a
}

function renderNotes (state, send) {
  var section = document.createElement('section')
  section.appendChild(renderNotesList(state, send))
  return section
}

function renderNotesList (state, send) {
  var notes = state.notesTree
  var replyTo = state.replyTo
  var ol = document.createElement('ol')
  ol.className = 'notesList'
  notes.forEach(function (note) {
    if (!note.message.body.range) {
      ol.appendChild(renderNote(state, note, send))
    }
  })
  var directLI = document.createElement('li')
  if (replyTo) {
    var button = document.createElement('button')
    button.appendChild(document.createTextNode('Add a note to the draft as a whole.'))
    button.addEventListener('click', function () {
      send('reply to', null)
    })
    directLI.appendChild(button)
  } else {
    directLI.appendChild(renderNoteForm(state, null, null, send))
  }
  ol.appendChild(directLI)
  return ol
}

function renderNote (state, note, send) {
  var li = document.createElement('li')
  li.id = note.digest
  var replyTo = state.replyTo
  var range = note.message.body.range
  if (range) {
    // <blockquote>
    var substring = document.createElement('blockquote')
    substring.appendChild(renderQuoteIcon())
    substring.appendChild(document.createTextNode(
      state.draft.message.body.text.substring(
        range.start, range.end
      )
    ))
    li.appendChild(substring)
  }
  // <p>
  var p = document.createElement('p')
  p.className = 'byline'
  p.appendChild(renderNoteIcon())
  p.appendChild(document.createTextNode(' '))
  p.appendChild(renderIntro(state, note.publicKey))
  p.appendChild(document.createTextNode(' on '))
  p.appendChild(renderTimestamp(note.message.body.timestamp))
  p.appendChild(document.createTextNode(':'))
  li.appendChild(p)
  // <blockquote>
  var blockquote = document.createElement('blockquote')
  blockquote.className = 'note'
  blockquote.appendChild(renderText(note.message.body.text))
  li.appendChild(blockquote)
  if (replyTo === note.digest) {
    li.appendChild(renderNoteForm(state, note.digest, null, send))
  } else {
    // <button>
    var button = document.createElement('button')
    button.addEventListener('click', function () {
      send('reply to', note.digest)
    })
    button.appendChild(document.createTextNode('Reply to this note.'))
    li.appendChild(button)
  }
  if (note.children.length !== 0) {
    var ol = document.createElement('ol')
    note.children.forEach(function (child) {
      ol.appendChild(renderNote(state, child, send))
    })
    li.appendChild(ol)
  }
  return li
}

function renderNoteForm (state, parent, range, send) {
  console.log(arguments)
  assert(typeof state, 'object')
  assert(parent === null || typeof parent === 'string')
  assert(
    range === null ||
    (
      typeof range === 'object' &&
      range.hasOwnProperty('start') &&
      range.hasOwnProperty('end')
    )
  )
  assert.equal(typeof send, 'function')
  var form = document.createElement('form')
  form.className = 'noteForm'
  form.addEventListener('submit', function (event) {
    event.preventDefault()
    event.stopPropagation()
    send('note', {
      parent,
      range,
      text: textarea.value
    })
  })
  if (range) {
    // <blockquote>
    var blockquote = document.createElement('blockquote')
    form.appendChild(blockquote)
    blockquote.appendChild(renderQuoteIcon())
    blockquote.appendChild(document.createTextNode(
      state.draft.message.body.text.substring(
        range.start, range.end
      )
    ))
  }
  // <textarea>
  var textarea = renderExpandingTextArea()
  textarea.required = true
  if (range) textarea.autofocus = true
  form.appendChild(textarea)
  // <button>
  var button = document.createElement('button')
  button.type = 'submit'
  button.appendChild(
    document.createTextNode(
      parent ? 'Add your reply.' : 'Add your note.'
    )
  )
  form.appendChild(button)
  return form
}
