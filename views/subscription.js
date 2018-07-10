var stripe = require('../stripe')

var renderDraftHeader = require('./partials/draft-header')
var renderLoading = require('./loading')
var renderPayment = require('./partials/payment')
var renderSection = require('./partials/section')
var renderSharing = require('./partials/sharing')

module.exports = function (state, send) {
  state.route = 'home'
  var main = document.createElement('main')
  if (!state.subscription) {
    main.appendChild(
      renderLoading(function () {
        send('load subscription')
      })
    )
  } else {
    main.appendChild(renderDraftHeader(state))
    var subscription = state.subscription
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
  var section = renderSection('Your Subscription')

  var emailParagraph = document.createElement('p')
  section.appendChild(emailParagraph)
  emailParagraph.appendChild(document.createTextNode(
    'The e-mail address for your subscription is ' +
    subscription.email + '.'
  ))

  var cancelParagraph = document.createElement('p')
  section.appendChild(cancelParagraph)
  cancelParagraph.appendChild(document.createTextNode(
    'To cancel your subscription, visit '
  ))

  var cancelLink = document.createElement('a')
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
  var section = renderSection('Subscription')
  section.appendChild(renderSharing())
  return section
}

function renderSubscribeSection (send) {
  // TODO: Load price dynamically.
  var section = renderSection('Subscribe')

  var price = document.createElement('p')
  section.appendChild(price)
  price.className = 'price'
  price.appendChild(document.createTextNode('$7 per month'))

  var billing = document.createElement('p')
  section.appendChild(billing)
  billing.className = 'billing'
  billing.appendChild(document.createTextNode(
    'Prorated. Cancel anytime.'
  ))

  section.appendChild(renderPayment())

  section.appendChild(renderEMailInput('subscribe-email'))

  var button = document.createElement('button')
  section.appendChild(button)
  button.onclick = function () {
    var card = document.getElementById('card').card
    stripe.createToken(card)
      .then(function (result) {
        if (result.error) {
          var errors = document.getElementById('card-errors')
          errors.textContent = result.error.message
          return
        }
        var token = result.token.id
        card.clear()
        var input = document.getElementById('subscribe-email')
        var email = input.value
        input.value = ''
        send('subscribe', {token, email})
      })
  }
  button.appendChild(document.createTextNode('Subscribe'))

  var next = document.createElement('p')
  section.appendChild(next)
  next.appendChild(document.createTextNode(
    'Proseline will send you an e-mail with a link to ' +
    'confirm your subscription.'
  ))

  return section
}

function renderAddDeviceSection (send) {
  var section = renderSection('Add To Subscription')

  var explanation = document.createElement('p')
  section.appendChild(explanation)
  explanation.appendChild(document.createTextNode(
    'If you already have a Proseline subscription, ' +
    'you can add this device to your account.'
  ))

  var form = document.createElement('form')
  section.appendChild(form)

  form.appendChild(renderEMailInput())

  var button = document.createElement('button')
  form.appendChild(button)
  button.type = 'submit'
  button.appendChild(document.createTextNode('Add to Account'))

  var next = document.createElement('p')
  form.appendChild(next)
  next.appendChild(document.createTextNode(
    'Proseline will send an e-mail to your address ' +
    'with a link you can click to confirm.'
  ))

  return section
}

function renderEMailInput (id) {
  var label = document.createElement('label')
  label.appendChild(document.createTextNode('Your E-Mail Address:'))

  var input = document.createElement('input')
  label.appendChild(input)
  input.type = 'email'
  input.required = true
  input.placeholder = 'you@example.com'
  input.name = 'email'
  input.id = id

  return input
}
