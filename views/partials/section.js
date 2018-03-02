module.exports = function (heading) {
  var section = document.createElement('section')
  var h2 = document.createElement('h2')
  section.appendChild(h2)
  h2.appendChild(document.createTextNode(heading))
  return section
}
