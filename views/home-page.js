var renderDraftHeader = require('./partials/draft-header')
var renderLoading = require('./loading')
var renderSection = require('./partials/section')
var renderSharing = require('./partials/sharing')

module.exports = function (state, send) {
  state.route = 'home'
  var main = document.createElement('main')
  if (!state.projects) {
    main.appendChild(
      renderLoading(function () {
        send('load projects')
      })
    )
  } else {
    main.appendChild(renderDraftHeader(state))
    main.appendChild(renderProjectsList(state.projects, send))
    main.appendChild(renderSubscriptionSection())
  }
  return main
}

function renderProjectsList (projects, send) {
  var section = renderSection('Projects')

  if (projects.length === 0) {
    var p = document.createElement('p')
    p.appendChild(document.createTextNode('You do not have any projects.'))
    section.appendChild(p)
  }
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
  var createProjectLI = document.createElement('li')
  ul.appendChild(createProjectLI)
  createProjectLI.appendChild(renderCreateProject(send))
  section.appendChild(ul)

  section.appendChild(renderBackup(send))

  return section
}

function renderCreateProject (send) {
  var form = document.createElement('form')
  form.onsubmit = function (event) {
    event.stopPropagation()
    event.preventDefault()
    send('create project', {
      title: this.elements.title.value
    })
  }

  var input = document.createElement('input')
  form.appendChild(input)
  input.name = 'title'
  input.required = true
  input.placeholder = 'Project Title'

  var button = document.createElement('button')
  form.appendChild(button)
  button.type = 'submit'
  button.appendChild(document.createTextNode('Create a project.'))

  return form
}

function renderBackup (send) {
  var button = document.createElement('button')
  button.addEventListener('click', function () {
    send('backup')
  })
  button.appendChild(document.createTextNode('Backup projects.'))
  return button
}

function renderSubscriptionSection () {
  var section = renderSection('Subscription')
  section.appendChild(renderSharing())
  var secondP = document.createElement('p')
  section.appendChild(secondP)
  secondP.appendChild(document.createTextNode(
    'To share your work with others while you are not online,' +
    'you can '
  ))
  var a = document.createElement('a')
  secondP.appendChild(a)
  a.href = '/subscription'
  a.appendChild(document.createTextNode(
    'subscribe to Proseline’s sharing service'
  ))
  secondP.appendChild(document.createTextNode('.'))
  return section
}
