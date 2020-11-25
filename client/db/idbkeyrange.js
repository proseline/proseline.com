module.exports = (
  window.IDBKeyRange ||
  window.mozIDBKeyRange ||
  window.webkitIDBKeyRange ||
  window.msIDBKeyRange
)
