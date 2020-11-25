const stripe = require('../../stripe')

module.exports = function () {
  const elements = stripe.elements()
  const card = elements.create('card')

  const returned = document.createDocumentFragment()

  const div = document.createElement('div')
  returned.appendChild(div)
  div.id = 'card'
  div.card = card

  card.mount(div)

  const errors = document.createElement('p')
  returned.appendChild(errors)
  errors.id = 'card-errors'

  return returned
}
