var loading = require('./loading')

module.exports = function (state, send) {
  var main = document.createElement('main')
  if (state.projects === null) {
    main.appendChild(
      loading(function () {
        send('load projects')
      })
    )
  } else {
    main.appendChild(projectsList(state.projects))
  }
  main.appendChild(newProject(send))
  return main
}

function projectsList (projects) {
  var section = document.createElement('section')
  var h1 = document.createElement('h1')
  h1.appendChild(document.createTextNode('Your projects'))
  section.appendChild(h1)
  if (projects.length === 0) {
    var p = document.createElement('p')
    p.appendChild(document.createTextNode('You do not have any projects.'))
    section.appendChild(p)
  } else {
    var ul = document.createElement('ul')
    projects.forEach(function (project) {
      var li = document.createElement('li')
      var a = document.createElement('a')
      a.href = '/projects/' + project.discoveryKey
      a.appendChild(document.createTextNode(project.title))
      li.appendChild(a)
      ul.appendChild(li)
    })
    section.appendChild(ul)
  }
  return section
}

function newProject (send) {
  var a = document.createElement('a')
  a.appendChild(document.createTextNode('New Project'))
  a.href = '/projects/new'
  return a
}
