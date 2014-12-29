
var util = require('util')

var stack = require('callsite')
var moment = require('moment')
var path = require('path')

var format = '[%s] %s %s:%d'

function Logger() {
}

Logger._log = function(level, args) {

  var trace = getTrace(stack()[2])
  var logMetadata = util.format(format,
                                level,
                                trace.timestamp,
                                trace.file,
                                trace.lineno,
                                '\t')
  
  var logData = util.format.apply(this, args)
  console.log.call(console, logMetadata, logData)
}

Logger.debug = function() {
  this._log('DEBUG', arguments)
}

Logger.info = function() {
  this._log('INFO', arguments)
}

Logger.warn = function() {
  this._log('WARN', arguments)
}

Logger.error = function() {
  this._log('ERROR', arguments)
}

function getTrace(call) {
  return {
    file: path.relative(process.cwd(), call.getFileName()),
    lineno: call.getLineNumber(),
    timestamp: moment().format("HH:mm:ss.SSS")
  }
}

module.exports = Logger
