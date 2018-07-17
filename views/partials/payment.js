var stripe = require('../../stripe')

module.exports = function () {
  var elements = stripe.elements()
  var card = elements.create('card')

  var returned = document.createDocumentFragment()

  var div = document.createElement('div')
  returned.appendChild(div)
  div.id = 'card'
  div.card = card

  card.mount(div)

  var errors = document.createElement('p')
  returned.appendChild(errors)
  errors.id = 'card-errors'

  return returned
}
