var stripe = require('../../stripe')

module.exports = function () {
  var elements = stripe.elements()
  var card = elements.create('card')
  var returned = document.createElement('div')
  returned.id = 'card'
  returned.card = card

  var errors = document.createElement('p')
  returned.appendChild(errors)
  errors.id = 'card-errors'

  card.mount(returned)

  return returned
}
