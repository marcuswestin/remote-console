require('socket.io/node_modules/socket.io-client/dist/socket.io') // exposes "io" globally
require('ui/dom').exposeGlobals()

var Class = require('std/Class'),
	bind = require('std/bind'),
	UIComponent = require('ui/dom/Component'),
	unique = require('std/unique')

var Console = Class(UIComponent, function() {
	
	this.init = function(socket) {
		this._sessions = {}
		this._outputs = {}
		this._socket = socket
			.on('SessionInfo', bind(this, this._renderSession))
			.on('SessionDead', bind(this, this._removeSession))
	}
	
	this.renderContent = function() {
		this._sessionList = DIV('sessions').appendTo(this)
		this._output = DIV('output').appendTo(this)
		this._input = INPUT('input', { keypress:bind(this, this._onKeyPress) }).appendTo(this)
	}
	
	this._renderSession = function(session) {
		console.log('_renderSession', session)
		var node = this._sessions[session.id]
		if (!node) {
			node = this._sessions[session.id] = DIV('session', session.id,
				{ click:bind(this, this._focusSession, session.id) }).appendTo(this._sessionList)
		}
		node.empty().append(
			JSON.stringify(session)
		)
	}
	
	this._removeSession = function(session) {
		this._sessions[session.id].remove()
		delete this._sessions[session.id]
	}
	
	this._focusSession = function(sessionID) {
		if (this._focusedSessionID) { this._sessions[this._focusedSessionID].removeClass('focused') }
		this._focusedSessionID = sessionID
		this._sessions[sessionID].addClass('focused')
	}
	
	this._onKeyPress = function(e) {
		if (e.keyCode != 13) { return } // enter
		setTimeout(bind(this, function() {
			var requestID = this._createOutput(),
				message = { sessionID:this._focusedSessionID, command:this._input.getElement().value, requestID:requestID }
			this._socket.emit('ExecuteClientCommand', message)
		}))
	}
	
	this._createOutput = function() {
		var id = unique()
		this._outputs[id] = DIV('output').appendTo(this._output)
	}
	
	this._handleResponse = function(err, response) {
		this._output.append(DIV('response ' + (err ? 'error' : 'message'), (response || err).toString()))
	}
})

new Console(io.connect('/consoles')).appendTo(document.body)
