module.exports = function (parentClass) {
  var selection = window.getSelection()
  if (selection.isCollapsed) return false

  var anchor = selection.anchorNode
  if (needParent(anchor)) anchor = anchor.parentNode
  var anchorOffset = selection.anchorOffset

  var focus = selection.focusNode
  if (needParent(focus)) focus = focus.parentNode
  var focusOffset = selection.focusOffset

  var haveRanges = hasRange(anchor) && hasRange(focus)
  if (!haveRanges) return false

  var anchorParent = renderedParent(anchor)
  if (!anchorParent) return false

  var focusParent = renderedParent(focus)
  if (!focusParent) return false

  if (anchorParent !== focusParent) return false
  if (!anchorParent.className.includes(parentClass)) return false

  var anchorPosition = position(anchor, anchorOffset)
  var focusPosition = position(anchor, focusOffset)
  return {
    start: Math.min(anchorPosition, focusPosition),
    end: Math.max(anchorPosition, focusPosition)
  }
}

function position (node, offset) {
  return startOf(node) + offset
}

function needParent (node) {
  return (
    node.nodeType === 3 ||
    node.nodeName === 'BR' ||
    node.nodeName === 'MARK'
  )
}

function hasRange (node) {
  return startOf(node) !== undefined && endOf(node) !== undefined
}

function startOf (node) {
  return parseInt(node.dataset.start)
}

function endOf (node) {
  return parseInt(node.dataset.end)
}

function renderedParent (node) {
  var parent = node.parentNode
  while (true) {
    if (parent.className.includes('renderedText')) return parent
    else if (parent === document.body) return false
    else parent = parent.parentNode
  }
}
