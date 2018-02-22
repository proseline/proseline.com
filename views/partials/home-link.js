module.exports = function () {
  var a = document.createElement('a')
  a.className = 'homeLink'
  a.appendChild(document.createTextNode('proseline'))
  a.href = '/'
  return a
}
