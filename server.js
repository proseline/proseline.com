const http = require('http')
const fs = require('fs')

http.createServer()
  .on('request', (request, response) => {
    const url = request.url
    if (url === '/styles.css') {
      response.setHeader('Content-Type', 'text/css')
      send('site/styles.css')
    } else if (url === '/normalize.css') {
      response.setHeader('Content-Type', 'text/css')
      send('site/normalize.css')
    } else if (url === '/styles.css.map') {
      send('site/styles.css.map')
    } else if (url === '/browser.js') {
      response.setHeader('Content-Type', 'application/json')
      send('site/browser.js')
    } else if (url === '/browser.js.map') {
      send('site/browser.js.map')
    } else {
      response.setHeader('Content-Type', 'text/html')
      send('site/index.html')
    }
    function send (path) {
      fs.createReadStream(path).pipe(response)
    }
  })
  .listen(process.env.PORT || 8000)
