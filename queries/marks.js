var getLatestIntro = require('./latest-introduction')
var runParallel = require('run-parallel')

module.exports = function (db, digest, callback) {
  getMarks(db, digest, function (error, marks) {
    if (error) return callback(error)
    var publicKeys = []
    marks.forEach(function (mark) {
      var publicKey = mark.public
      if (!publicKeys.includes(publicKey)) {
        publicKeys.push(publicKey)
      }
    })
    var jobs = {}
    publicKeys.forEach(function (publicKey) {
      jobs[publicKey] = function (done) {
        getLatestIntro(db, publicKey, done)
      }
    })
    runParallel(jobs, function (error, markIntros) {
      if (error) return callback(error)
      callback(null, {
        marks: marks,
        markIntroductions: markIntros
      })
    })
  })
}

function getMarks (db, digest, callback) {
  var transaction = db.transaction(['marks'], 'readonly')
  transaction.onerror = function () {
    callback(transaction.error)
  }
  var objectStore = transaction.objectStore('marks')
  var index = objectStore.index('draft')
  var request = index.openCursor(digest)
  var marks = []
  request.onsuccess = function () {
    var cursor = request.result
    if (cursor) {
      var value = cursor.value
      marks.push(value)
      cursor.continue()
    } else {
      callback(null, marks)
    }
  }
}
