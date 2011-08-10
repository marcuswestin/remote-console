require('socket.io/node_modules/socket.io-client/dist/socket.io') // exposes "io" globally
require('ui/dom').exposeGlobals()

var Class = require('std/Class'),
	bind = require('std/bind'),
	UIComponent = require('ui/dom/Component'),
	on = require('ui/dom/on'),
	getWindowSize = require('ui/dom/getWindowSize')

var Console = Class(UIComponent, function() {
	
	this._class = 'Console'

	this.init = function(socket) {
		this._sessionNodes = {}
		this._sessionOutputs = {}
		this._commandNodes = {}
		this._outputs = {}
		this._socket = socket
			.on('SessionInfo', bind(this, this._renderSession))
			.on('SessionDead', bind(this, this._removeSession))
			.on('ClientEvent', bind(this, this._renderClientEvent))
	}
	
	this.renderContent = function() {
		this.append(DIV(
			this._sessionList = DIV('sessions', { style:{ gradient:'#333 #fff bottom' }}),
			this._screen = DIV('screen',
				this._output = DIV('output'),
				this._input = INPUT('input', { keypress:bind(this, this._onKeyPress) })
			)
		))
		on(window, 'resize', bind(this, this._layout))
		this._layout()
	}

	this._renderClientEvent = function(event) {
		var parentNode = this._sessionOutputs[event.sessionID]
		if (!parentNode) { return console.error("_renderClientEvent did not find node") }
		
		if (event.type == 'response') { parentNode = this._commandNodes[event.commandID] }
		
		var eventNode = DIV('clientEvent', 
			SPAN('type', event.type, ' '),
			SPAN('data', event.args.join(' '))
		).appendTo(parentNode)
		
		if (event.type == 'command') { this._commandNodes[event.commandID] = eventNode }
	}
	
	var listWidth = 300,
		inputHeight = 40
	this._layout = function() {
		var size = getWindowSize(this.getWindow()),
			screenWidth = size.width-listWidth
		
		this._sessionList.style({ left:0, width:listWidth, height:size.height })
		this._screen.style({ left:listWidth, width:screenWidth, height:size.height })
		this._input.style({ width:screenWidth-90, height:inputHeight-100 })
		this._output.style({ height:size.height-inputHeight })
	}
	
	this._renderSession = function(session) {
		var node = this._sessionNodes[session.id]
		if (!node) {
			node = this._sessionNodes[session.id] = DIV('session', session.id,
				{ click:bind(this, this._focusSession, session.id), style:{ gradient:'#fff ' + session.color + ' left'} }
			).appendTo(this._sessionList)
		}
		node.empty().append(
			DIV('title',
				SPAN('name', session.clientInfo.name),
				SPAN('version', ' ', session.clientInfo.version)
			),
			DIV('clients',
				session.sockets.length, ' tabs open'
			)
		)
		if (!this._sessionOutputs[session.id]) {
			this._sessionOutputs[session.id] = DIV('session-output',
				{ style:{ gradient:'#fff ' + session.color + ' left' } }
			).appendTo(this._output)
		}
	}
	
	this._removeSession = function(session) {
		this._sessionNodes[session.id].remove()
		delete this._sessionNodes[session.id]
	}
	
	this._focusSession = function(sessionID) {
		if (this._focusedSessionID) { this._sessionNodes[this._focusedSessionID].removeClass('focused') }
		this._focusedSessionID = sessionID
		this._sessionNodes[sessionID].addClass('focused')
	}
	
	this._onKeyPress = function(e) {
		if (e.keyCode != 13) { return } // enter
		setTimeout(bind(this, function() {
			this._socket.emit('ExecuteClientCommand', { sessionID:this._focusedSessionID, command:this._input.getElement().value })
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
