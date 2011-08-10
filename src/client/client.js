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
			session.registerEvent('console.log', args)
		})
		
		session.on('ExecuteCommand', function (message, callback) {
			try { var value = eval(message.command) }
			catch(err) { var error = err }
			session.emit('CommandResponse', { value:value, error:error, commandID:message.commandID })
		})
	})
})()
