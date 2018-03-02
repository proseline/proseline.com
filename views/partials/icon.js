var fontawesome = require('@fortawesome/fontawesome')

module.exports = function (icon) {
  return fontawesome.icon(icon).node[0]
}
