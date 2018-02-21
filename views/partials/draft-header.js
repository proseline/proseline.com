module.exports = function (state, addition) {
  var header = document.createElement('header')

  var proseline = document.createElement('a')
  proseline.appendChild(document.createTextNode('proseline'))
  proseline.href = '/'
  header.appendChild(proseline)

  var project = document.createElement('a')
  project.appendChild(document.createTextNode(state.title))
  project.href = '/projects/' + state.discoveryKey
  header.appendChild(project)

  if (addition) header.appendChild(addition)

  return header
}
