
var util = require('util')

var stack = require('callsite')
var moment = require('moment')
var path = require('path')
var _ = require('lodash')

var format = '[%s] %s %s:%d'

var debug = false

function Logger() {
}

Logger._log = function(level, args) {

  var trace = getTrace(stack()[2])
  var logData = util.format(format,
                                level,
                                trace.timestamp,
                                trace.file,
                                trace.lineno)

  _.each(args, function(value) {
    if(value instanceof Error) {
      logData += ' ' + value.message + '\n'
      logData += value.stack + '\n'
    } else if(typeof value === 'string') {
      logData += ' ' + value
    } else {
      try {
          logData += ' ' + JSON.stringify(value)
      } catch(err) {
        logData += ' ' + value
      }
    }
  })
  
  console.log.call(console, logData)
}

Logger.debug = function() {
  if(!debug) { return }
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
