/* global SVGAnimatedString */
module.exports = function findLocalLinkAnchor (node) {
  if (!node) return undefined
  var checkParent = !node || !hasHREF(node)
  return checkParent ? findLocalLinkAnchor(node.parentNode) : node
}

function hasHREF (element) {
  if (!element.href) return false
  if (element.href instanceof SVGAnimatedString) {
    return !!element.href.baseVal
  }
  return true
}
