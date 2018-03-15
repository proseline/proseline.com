var SVG = require('../../svg')

module.exports = function (x, y, color, width) {
  var bookmarkHeight = width * 2
  var bookmarkNotch = width / 2
  var bookmark = document.createElementNS(SVG, 'path')
  var commands = [
    ['M', x, y],
    ['l', width, 0],
    ['l', 0, bookmarkHeight],
    ['l', -(width / 2), -bookmarkNotch],
    ['l', -(width / 2), +bookmarkNotch],
    ['z']
  ]
    .map(function (element) {
      return element[0] + element.slice(1).join(' ')
    })
    .join(' ')
  bookmark.setAttributeNS(null, 'd', commands)
  bookmark.setAttributeNS(null, 'fill', color)
  bookmark.setAttributeNS(null, 'stroke', 'black')
  bookmark.setAttributeNS(null, 'stroke-width', 2)
  return bookmark
}
