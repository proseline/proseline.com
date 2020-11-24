const stripe = require('../stripe')

const renderDraftHeader = require('./partials/draft-header')
const renderLoading = require('./loading')
const renderPayment = require('./partials/payment')
const renderSection = require('./partials/section')
const renderSharing = require('./partials/sharing')

module.exports = (state, send) => {
  state.route = 'home'
  const main = document.createElement('main')
  if (!state.subscription) {
    main.appendChild(
      renderLoading(function () {
        send('load subscription')
      })
    )
  } else {
    main.appendChild(renderDraftHeader(state))
    const subscription = state.subscription
    if (subscription.email) {
      main.appendChild(renderCurrentSubscription(subscription))
    } else {
      main.appendChild(renderOverviewSection())
      main.appendChild(renderSubscribeSection(send))
      main.appendChild(renderAddDeviceSection(send))
    }
  }
  return main
}

function renderCurrentSubscription (subscription) {
  const section = renderSection('Your Subscription')

  const emailParagraph = document.createElement('p')
  section.appendChild(emailParagraph)
  emailParagraph.appendChild(document.createTextNode(
    'The e-mail address for your subscription is ' +
    subscription.email + '.'
  ))

  const cancelParagraph = document.createElement('p')
  section.appendChild(cancelParagraph)
  cancelParagraph.appendChild(document.createTextNode(
    'To cancel your subscription, visit '
  ))

  const cancelLink = document.createElement('a')
  cancelParagraph.appendChild(cancelLink)
  cancelLink.href = 'https://paid.proseline.com/cancel'
  cancelLink.target = '_blank'
  cancelLink.appendChild(document.createTextNode(
    'the subscription cancel page'
  ))

  cancelParagraph.appendChild(document.createTextNode('.'))

  return section
}

function renderOverviewSection (state) {
  const section = renderSection('Subscription')
  section.appendChild(renderSharing())
  return section
}

function renderSubscribeSection (send) {
  // TODO: Load price dynamically.
  const section = renderSection('Subscribe')

  const price = document.createElement('p')
  section.appendChild(price)
  price.className = 'price'
  price.appendChild(document.createTextNode('$7 per month'))

  const billing = document.createElement('p')
  section.appendChild(billing)
  billing.className = 'billing'
  billing.appendChild(document.createTextNode(
    'Prorated. Cancel anytime.'
  ))

  section.appendChild(renderPayment())

  section.appendChild(renderEMailInput('subscribe-email'))

  const button = document.createElement('button')
  section.appendChild(button)
  button.onclick = function () {
    const card = document.getElementById('card').card
    stripe.createToken(card)
      .then(result => {
        if (result.error) {
          const errors = document.getElementById('card-errors')
          errors.textContent = result.error.entry
          return
        }
        const token = result.token.id
        card.clear()
        const input = document.getElementById('subscribe-email')
        const email = input.value
        input.value = ''
        send('subscribe', { token, email })
      })
  }
  button.appendChild(document.createTextNode('Subscribe'))

  const next = document.createElement('p')
  section.appendChild(next)
  next.appendChild(document.createTextNode(
    'Proseline will send you an e-mail with a link to ' +
    'confirm your subscription.'
  ))

  return section
}

function renderAddDeviceSection (send) {
  const section = renderSection('Add To Subscription')

  const explanation = document.createElement('p')
  section.appendChild(explanation)
  explanation.appendChild(document.createTextNode(
    'If you already have a Proseline subscription, ' +
    'you can add this device to your account.'
  ))

  const form = document.createElement('form')
  section.appendChild(form)

  form.appendChild(renderEMailInput())
  form.appendChild(renderDeviceNameInput())

  form.onsubmit = function (event) {
    event.preventDefault()
    event.stopPropagation()
    const email = this.elements.email.value
    const name = this.elements.name.value
    send('add device to subscription', { email, name })
    this.elements.email.value = ''
  }

  const button = document.createElement('button')
  form.appendChild(button)
  button.type = 'submit'
  button.appendChild(document.createTextNode('Add to Account'))

  const next = document.createElement('p')
  form.appendChild(next)
  next.appendChild(document.createTextNode(
    'Proseline will send an e-mail to your address ' +
    'with a link you can click to confirm.'
  ))

  return section
}

function renderEMailInput (id) {
  const label = document.createElement('label')
  label.appendChild(document.createTextNode('Your E-Mail Address:'))

  const input = document.createElement('input')
  label.appendChild(input)
  input.type = 'email'
  input.required = true
  input.placeholder = 'you@example.com'
  input.name = 'email'
  input.id = id

  return label
}

function renderDeviceNameInput () {
  const label = document.createElement('label')
  label.appendChild(document.createTextNode('Name for this Device:'))

  const input = document.createElement('input')
  label.appendChild(input)
  input.type = 'text'
  input.required = true
  input.placeholder = 'laptop'
  input.minlength = 3
  input.maxlength = 32
  input.name = 'name'

  return label
}
