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
		this._colors = {}
		this._socket = socket
			.on('SessionInfo', bind(this, this._renderSession))
			.on('SessionDead', bind(this, this._removeSession))
			.on('ClientEvent', bind(this, this._renderClientEvent))
	}
	
	this.renderContent = function() {
		this.append(DIV(
			this._sessionList = DIV('SessionList', { style:{ gradient:'#333 #fff right' }}),
			this._screen = DIV('screen',
				this._output = DIV('output'),
				this._input = INPUT('input', { keypress:bind(this, this._onKeyPress) }),
				DIV('input-caret command-caret', '>')
			)
		))
		on(window, 'resize', bind(this, this._layout))
		this._layout()
	}

	this._renderClientEvent = function(event) {
		var parentNode = this._sessionOutputs[event.sessionID]
		if (!parentNode) { return console.error("_renderClientEvent did not find node") }
		
		var wasScrolledDown = (parentNode.getElement().scrollTop + parentNode.getOffset().height == parentNode.getElement().scrollHeight)
		
		if (event.type == 'response') { parentNode = this._commandNodes[event.commandID] }
		
		var eventNode = DIV((event.type == 'response' ? 'response' : 'clientEvent'), 
			(event.type == 'command' ? SPAN('input-caret', '>') : SPAN('type', event.type, ' ')),
			SPAN('data', event.args.join(' '))
		).appendTo(parentNode)
		
		if (event.type == 'command') { this._commandNodes[event.commandID] = eventNode }
		
		if (wasScrolledDown) {
			setTimeout(function() { parentNode.getElement().scrollTop = parentNode.getElement().scrollHeight }, 10)
			setTimeout(function() { parentNode.getElement().scrollTop = parentNode.getElement().scrollHeight }, 100)
		}
	}
	
	var listWidth = 300,
		inputHeight = 58
	this._layout = function() {
		var size = getWindowSize(this.getWindow()),
			screenWidth = size.width-listWidth
		
		this._sessionList.style({ left:0, width:listWidth, height:size.height })
		this._screen.style({ left:listWidth, width:screenWidth, height:size.height })
		this._input.style({ width:screenWidth-26 })
		this._output.style({ height:size.height-inputHeight })
		
		if (this._sessionOutputs[this._focusedSessionID]) {
			this._sessionOutputs[this._focusedSessionID].style({ height:size.height-inputHeight })
		}
	}
	
	this._renderSession = function(session) {
		var node = this._sessionNodes[session.id]
		if (!node) {
			this._colors[session.id] = session.color
			node = this._sessionNodes[session.id] = DIV('session', session.id,
				{ click:bind(this, this._focusSession, session.id), style:{ gradient:'#fff ' + session.color + ' left' } }
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
			this._sessionOutputs[session.id] = DIV('sessionOutput').appendTo(this._output)
			this._sessionOutputs[session.id].scrollTop = this._sessionOutputs[session.id].scrollHeight
		}
	}
	
	this._removeSession = function(session) {
		this._sessionNodes[session.id].remove()
		this._sessionOutputs[session.id].remove()
		delete this._sessionNodes[session.id]
		delete this._sessionOutputs[session.id]
	}
	
	this._focusSession = function(sessionID) {
		if (this._focusedSessionID && this._sessionNodes[this._focusedSessionID]) {
			this._sessionNodes[this._focusedSessionID].removeClass('focused')
			this._sessionOutputs[this._focusedSessionID].removeClass('focused')
		}
		this._focusedSessionID = sessionID
		this._sessionNodes[this._focusedSessionID].addClass('focused')
		this._sessionOutputs[this._focusedSessionID].addClass('focused')
		this._output.style({ padding:10, gradient:this._colors[this._focusedSessionID] + ' #fff left' })
		this._layout()
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
