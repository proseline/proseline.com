var renderHomeLink = require('./partials/home-link')
var renderLoading = require('./loading')
var renderSection = require('./partials/section')

// TODO: paid peer UI

module.exports = function (state, send) {
  var main = document.createElement('main')
  if (!state.projects) {
    main.appendChild(
      renderLoading(function () {
        send('load projects')
      })
    )
  } else {
    main.appendChild(renderHeader())
    main.appendChild(renderProjectsList(state.projects))
    main.appendChild(renderCreateProject(send))
    main.appendChild(renderBackup(send))
  }
  return main
}

function renderHeader () {
  var header = document.createElement('header')
  header.appendChild(renderHomeLink())
  return header
}

function renderProjectsList (projects) {
  var section = renderSection('Projects')

  if (projects.length === 0) {
    var p = document.createElement('p')
    p.appendChild(document.createTextNode('You do not have any projects.'))
    section.appendChild(p)
  } else {
    var ul = document.createElement('ul')
    projects
      .sort(function (a, b) {
        return a.title.toLowerCase().localeCompare(b.title.toLowerCase())
      })
      .forEach(function (project) {
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

function renderCreateProject (send) {
  var button = document.createElement('button')
  button.addEventListener('click', function () {
    send('create project')
  })
  button.appendChild(document.createTextNode('Create a project.'))
  return button
}

function renderBackup (send) {
  var button = document.createElement('button')
  button.addEventListener('click', function () {
    send('backup')
  })
  button.appendChild(document.createTextNode('Backup projects.'))
  return button
}
