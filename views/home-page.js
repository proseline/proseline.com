var loading = require('./loading')
var renderHomeLink = require('./partials/home-link')

// TODO: private key backup link

// TODO: paid peer UI

module.exports = function (state, send) {
  var main = document.createElement('main')
  if (!state.projects) {
    main.appendChild(
      loading(function () {
        send('load projects')
      })
    )
  } else {
    main.appendChild(header())
    main.appendChild(projectsList(state.projects))
    main.appendChild(createProject(send))
    main.appendChild(joinProject(send))
  }
  return main
}

function header () {
  var header = document.createElement('header')
  header.appendChild(renderHomeLink())
  return header
}

function projectsList (projects) {
  var section = document.createElement('section')
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

function createProject (send) {
  var button = document.createElement('button')
  button.addEventListener('click', function () {
    var title = window.prompt('Enter a title:')
    if (title === null) return
    if (title.length === 0) return
    send('create project', {
      title: title
    })
  })
  button.appendChild(document.createTextNode('Create Project'))
  return button
}

function joinProject (send) {
  var button = document.createElement('button')
  button.addEventListener('click', function () {
    var secretKey = window.prompt('Enter invite code:')
    if (secretKey === null) return
    secretKey = /[a-f0-9]{64}$/.exec(secretKey)[0]
    send('join project', secretKey)
  })
  button.appendChild(document.createTextNode('Join Project'))
  return button
}
