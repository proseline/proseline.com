var http = require('http')
var fs = require('fs')

http.createServer()
  .on('request', function (request, response) {
    var url = request.url
    if (url === '/styles.css') {
      response.setHeader('Content-Type', 'text/css')
      send('build/styles.css')
    } else if (url === '/normalize.css') {
      response.setHeader('Content-Type', 'text/css')
      send('build/normalize.css')
    } else if (url === '/styles.css.map') {
      send('build/styles.css.map')
    } else if (url === '/browser.js') {
      response.setHeader('Content-Type', 'application/json')
      send('build/browser.js')
    } else if (url === '/browser.js.map') {
      send('build/browser.js.map')
    } else {
      response.setHeader('Content-Type', 'text/html')
      send('build/index.html')
    }
    function send (path) {
      fs.createReadStream(path).pipe(response)
    }
  })
  .listen(process.env.PORT || 8000)
