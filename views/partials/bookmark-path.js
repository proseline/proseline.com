const SVG = require('../../svg')

module.exports = (x, y, color, width) => {
  const bookmarkHeight = width * 2
  const bookmarkNotch = width / 2
  const bookmark = document.createElementNS(SVG, 'path')
  const commands = [
    ['M', x, y],
    ['l', width, 0],
    ['l', 0, bookmarkHeight],
    ['l', -(width / 2), -bookmarkNotch],
    ['l', -(width / 2), +bookmarkNotch],
    ['z']
  ]
    .map(element => {
      return element[0] + element.slice(1).join(' ')
    })
    .join(' ')
  bookmark.setAttributeNS(null, 'd', commands)
  bookmark.setAttributeNS(null, 'fill', color)
  bookmark.setAttributeNS(null, 'stroke', 'black')
  bookmark.setAttributeNS(null, 'stroke-width', 2)
  return bookmark
}
