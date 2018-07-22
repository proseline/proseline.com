module.exports = function findLocalLinkAnchor (node) {
  if (!node) return undefined
  var checkParent = !node || !hasHREF(node)
  return checkParent ? findLocalLinkAnchor(node.parentNode) : node
}

function hasHREF (element) {
  if (element.href) return true
  if (
    element.getAttributeNS &&
    element.getAttribute('href') &&
    element.getAttribute('href').baseVal
  ) return true
  return false
}
