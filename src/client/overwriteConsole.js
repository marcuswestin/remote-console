var slice = require('std/slice')

module.exports = function overwriteConsole(callback) {
	var oldFn = {}
	createLogger('log')
	
	function createLogger(type) {
		oldFn[type] = window.console[type]
		window.console[type] = function() {
			callback('console.'+type, slice(arguments, 0))
			return oldFn[type].apply(window.console, arguments)
		}
	}
}