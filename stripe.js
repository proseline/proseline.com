/* globals Stripe */

var PUBLIC = process.env.STRIPE_PUBLIC_KEY

module.exports = Stripe(PUBLIC)
