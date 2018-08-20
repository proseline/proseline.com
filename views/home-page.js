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
    main.appendChild(renderProjectsList(state.subscription, state.projects, send))
    main.appendChild(renderSubscriptionSection())
  }
  return main
}

function renderProjectsList (subscription, projects, send) {
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
  createProjectLI.appendChild(renderCreateProject(subscription, send))
  section.appendChild(ul)

  section.appendChild(renderBackup(send))

  return section
}

function renderCreateProject (subscription, send) {
  var form = document.createElement('form')
  form.onsubmit = function (event) {
    event.stopPropagation()
    event.preventDefault()
    var data = {title: this.elements.title.value}
    if (this.elements.persistent) {
      data.persistent = this.elements.persistent.value
    }
    send('create project', data)
  }

  var input = document.createElement('input')
  form.appendChild(input)
  input.name = 'title'
  input.required = true
  input.placeholder = 'Project Title'

  if (subscription.email) {
    var label = document.createElement('label')
    form.appendChild(label)
    var checkbox = document.createElement('input')
    label.appendChild(checkbox)
    checkbox.type = 'checkbox'
    checkbox.name = 'persistent'
    label.appendChild(document.createTextNode('Share when you’re offline.'))
  }

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
  section.appendChild(renderSharing(true))
  return section
}
