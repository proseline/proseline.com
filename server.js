var http = require('http')

var ecstatic = require('ecstatic')({
  root: 'build',
  cache: 0
})

http
  .createServer(function (request, response) {
    ecstatic(request, response, {handleError: false})
  })
  .listen(process.env.PORT || 8000)
