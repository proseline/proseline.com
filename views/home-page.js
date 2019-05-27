var crypto = require('@proseline/crypto')
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
    main.appendChild(renderActiveProjectsList(state.subscription, state.projects, send))
    main.appendChild(renderArchivedProjectsList(state.subscription, state.projects, send))
    main.appendChild(renderSubscriptionSection())
    main.appendChild(renderBackupSection(send))
  }
  return main
}

function renderActiveProjectsList (subscription, projects, send) {
  var section = renderSection('Active Projects')

  var activeProjects = projects.filter(function (project) {
    return !project.deleted
  })

  if (activeProjects.length === 0) {
    var p = document.createElement('p')
    p.appendChild(document.createTextNode('You do not have any active projects.'))
    section.appendChild(p)
  }
  var ul = document.createElement('ul')
  ul.className = 'activeProjects'
  activeProjects
    .sort(function byTitle (a, b) {
      return a.title.toLowerCase().localeCompare(b.title.toLowerCase())
    })
    .forEach(function (project) {
      var li = document.createElement('li')
      var a = document.createElement('a')
      a.href = '/projects/' + crypto.base64ToHex(project.discoveryKey)
      a.appendChild(document.createTextNode(project.title))
      li.appendChild(a)
      ul.appendChild(li)
    })
  var createProjectLI = document.createElement('li')
  ul.appendChild(createProjectLI)
  createProjectLI.appendChild(renderCreateProject(subscription, send))
  section.appendChild(ul)

  return section
}

function renderArchivedProjectsList (subscription, projects, send) {
  var section = renderSection('Archived Projects')

  var archivedProjects = projects.filter(function (project) {
    if (!project.deleted) return false
    return project.projectKeyPair && project.replicationKey
  })

  if (archivedProjects.length === 0) {
    var p = document.createElement('p')
    p.appendChild(document.createTextNode('You do not have any archived projects.'))
    section.appendChild(p)
  }
  var ul = document.createElement('ul')
  ul.className = 'archivedProjects'
  archivedProjects
    .sort(function byTitle (a, b) {
      return a.title.toLowerCase().localeCompare(b.title.toLowerCase())
    })
    .forEach(function (project) {
      var li = document.createElement('li')
      var a = document.createElement('a')
      a.appendChild(document.createTextNode(project.title))
      var button = document.createElement('button')
      button.addEventListener('click', function () {
        send('join project', project)
      })
      button.appendChild(document.createTextNode('Rejoin project.'))
      a.appendChild(button)
      li.appendChild(a)
      ul.appendChild(li)
    })
  section.appendChild(ul)

  return section
}

function renderCreateProject (subscription, send) {
  var form = document.createElement('form')
  form.onsubmit = function (event) {
    event.stopPropagation()
    event.preventDefault()
    var data = { title: this.elements.title.value }
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

function renderSubscriptionSection () {
  var section = renderSection('Subscription')
  section.appendChild(renderSharing(true))
  return section
}

function renderBackupSection (send) {
  var section = renderSection('Backup')
  var button = document.createElement('button')
  button.addEventListener('click', function () {
    send('backup')
  })
  button.appendChild(document.createTextNode('Backup your project data.'))
  section.appendChild(button)
  return section
}
