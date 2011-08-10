(function(){
	var overwriteConsole = require('./overwriteConsole'),
		Session = require('./Session'),
		on = require('ui/dom/on')
	
	var session = new Session()
	session.connect(function() {
		
		session.registerEvent('tab-load')
		
		on(window, 'beforeunload', function() {
			session.registerEvent('tab-unload')
		})
		
		overwriteConsole(function(type, args) {
			session.registerEvent('console-log', args)
		})
		
		session.on('ExecuteClientCommand', function (command, callback) {
			try { callback({ value:eval(command) }) }
			catch(error) { callback({ error:error }) }
		})
	})
})()
