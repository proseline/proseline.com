module.exports = heading => {
  const section = document.createElement('section')
  const h2 = document.createElement('h2')
  section.appendChild(h2)
  h2.appendChild(document.createTextNode(heading))
  return section
}
