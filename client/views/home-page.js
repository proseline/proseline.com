const crypto = require('@proseline/crypto')
const renderDraftHeader = require('./partials/draft-header')
const renderLoading = require('./loading')
const renderSection = require('./partials/section')
const renderSharing = require('./partials/sharing')

module.exports = (state, send) => {
  state.route = 'home'
  const main = document.createElement('main')
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
  const section = renderSection('Active Projects')

  const activeProjects = projects.filter(project => {
    return !project.deleted
  })

  if (activeProjects.length === 0) {
    const p = document.createElement('p')
    p.appendChild(document.createTextNode('You do not have any active projects.'))
    section.appendChild(p)
  }
  const ul = document.createElement('ul')
  ul.className = 'activeProjects'
  activeProjects
    .sort(function byTitle (a, b) {
      return a.title.toLowerCase().localeCompare(b.title.toLowerCase())
    })
    .forEach(project => {
      const li = document.createElement('li')
      const a = document.createElement('a')
      a.href = '/projects/' + crypto.base64ToHex(project.discoveryKey)
      a.appendChild(document.createTextNode(project.title))
      li.appendChild(a)
      ul.appendChild(li)
    })
  const createProjectLI = document.createElement('li')
  ul.appendChild(createProjectLI)
  createProjectLI.appendChild(renderCreateProject(subscription, send))
  section.appendChild(ul)

  return section
}

function renderArchivedProjectsList (subscription, projects, send) {
  const section = renderSection('Archived Projects')

  const archivedProjects = projects.filter(project => {
    if (!project.deleted) return false
    return project.projectKeyPair && project.replicationKey
  })

  if (archivedProjects.length === 0) {
    const p = document.createElement('p')
    p.appendChild(document.createTextNode('You do not have any archived projects.'))
    section.appendChild(p)
  }
  const ul = document.createElement('ul')
  ul.className = 'archivedProjects'
  archivedProjects
    .sort(function byTitle (a, b) {
      return a.title.toLowerCase().localeCompare(b.title.toLowerCase())
    })
    .forEach(project => {
      const li = document.createElement('li')
      const a = document.createElement('a')
      a.appendChild(document.createTextNode(project.title))
      const button = document.createElement('button')
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
  const form = document.createElement('form')
  form.onsubmit = event => {
    event.stopPropagation()
    event.preventDefault()
    const data = { title: this.elements.title.value }
    if (this.elements.persistent) {
      data.persistent = this.elements.persistent.value
    }
    send('create project', data)
  }

  const input = document.createElement('input')
  form.appendChild(input)
  input.name = 'title'
  input.required = true
  input.placeholder = 'Project Title'

  if (subscription.email) {
    const label = document.createElement('label')
    form.appendChild(label)
    const checkbox = document.createElement('input')
    label.appendChild(checkbox)
    checkbox.type = 'checkbox'
    checkbox.name = 'persistent'
    label.appendChild(document.createTextNode('Share when you’re offline.'))
  }

  const button = document.createElement('button')
  form.appendChild(button)
  button.type = 'submit'
  button.appendChild(document.createTextNode('Create a project.'))

  return form
}

function renderSubscriptionSection () {
  const section = renderSection('Subscription')
  section.appendChild(renderSharing(true))
  return section
}

function renderBackupSection (send) {
  const section = renderSection('Backup')
  const button = document.createElement('button')
  button.addEventListener('click', function () {
    send('backup')
  })
  button.appendChild(document.createTextNode('Backup your project data.'))
  section.appendChild(button)
  return section
}
