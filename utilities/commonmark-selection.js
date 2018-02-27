var parseSourcePosition = require('./parse-source-position')

module.exports = function (window, source) {
  var selection = window.getSelection()
  if (selection.isCollapsed) return

  var anchor = selection.anchorNode
  if (anchor.nodeType === 3) anchor = anchor.parentNode
  var anchorOffset = selection.anchorOffset
  var focus = selection.focusNode
  if (focus.nodeType === 3) focus = focus.parentNode
  var focusOffset = selection.focusOffset

  var bothCommonMark = (
    isCommonMark(anchor) &&
    isCommonMark(focus)
  )
  if (!bothCommonMark) return false

  // TODO: Check that in same rendered parent.

  var anchorPosition = parseSourcePosition(anchor)
  var focusPosition = parseSourcePosition(focus)

  var lineLengths = source
    .split('\n')
    .map(function (line) {
      return line.length
    })

  var anchorRange = withOffset(anchorPosition, anchorOffset, lineLengths)
  var focusRange = withOffset(focusPosition, focusOffset, lineLengths)
  var start, end
  if (anchorRange.line > focusRange.line) start = focusRange
  else if (anchorRange.line < focusRange.line) start = anchorRange
  else if (anchorRange.character > focusRange.character) start = focusRange
  else start = anchorRange
  end = start === anchorRange ? focusRange : anchorRange
  return {start, end}
}

function withOffset (position, offset, lineLengths) {
  var onOneLine = position.start.line === position.end.line
  if (onOneLine) {
    return {
      line: position.start.line,
      character: position.start.character + offset
    }
  } else {
    var character = offset
    var line = position.start.line
    while (true) {
      var lineLength = lineLengths[line]
      if (lineLength >= character) break
      character -= lineLength
      line++
    }
    return {line, character}
  }
}

function isCommonMark (node) {
  return Boolean(positionOf(node))
}

function positionOf (node) {
  return node.dataset.sourcepos
}
