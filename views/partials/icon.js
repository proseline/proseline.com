const fontawesome = require('@fortawesome/fontawesome')

module.exports = icon => {
  return fontawesome.icon(icon).node[0]
}
