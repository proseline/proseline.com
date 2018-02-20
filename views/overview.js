var loading = require('./loading')

// TODO: private key backup link

// TODO: global introduction

// TODO: paid peer UI

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
    main.appendChild(newProject(send))
    main.appendChild(joinProject(send))
  }
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

// TODO: link to e-mail join invite

function joinProject (send) {
  var form = document.createElement('form')
  form.addEventListener('submit', function (event) {
    event.preventDefault()
    event.stopPropagation()
    send('join project', input.value)
  })
  var input = document.createElement('input')
  form.appendChild(input)
  input.placeholder = 'Invite Code'
  var button = document.createElement('button')
  form.appendChild(button)
  button.appendChild(document.createTextNode('Join'))
  button.type = 'submit'
  return form
}
