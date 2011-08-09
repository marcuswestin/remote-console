require('socket.io/node_modules/socket.io-client/dist/socket.io') // exposes "io" globally
require('ui/dom').exposeGlobals()

var Class = require('std/Class'),
	bind = require('std/bind'),
	UIComponent = require('ui/dom/Component')

var Console = module.exports = Class(UIComponent, function() {
	
	this.init = function(socket) {
		this._clients = {}
		this._socket = socket
			.on('ClientConnect', bind(this, this._renderClient))
			.on('ClientDisconnect', bind(this, this._removeClient))
	}
	
	this.renderContent = function() {
		this._clientList = DIV('clients').appendTo(this)
		this._output = DIV('output').appendTo(this)
		this._input = INPUT('input', { keypress:bind(this, this._onKeyPress) }).appendTo(this)
	}
	
	this._renderClient = function(client) {
		var node = DIV('client', client.id, { click:bind(this, this._focusClient, client.id) }).appendTo(this._clientList)
		this._clients[client.id] = node
	}
	
	this._removeClient = function(client) {
		this._clients[client.id].remove()
		delete this._clients[client.id]
	}
	
	this._focusClient = function(clientID) {
		if (this._focusedClientID) { this._clients[this._focusedClientID].removeClass('focused') }
		this._focusedClientID = clientID
		this._clients[clientID].addClass('focused')
	}
	
	this._onKeyPress = function(e) {
		if (e.keyCode != 13) { return } // enter
		setTimeout(bind(this, function() {
			var message = { clientID:this._focusedClientID, command:this._input.getElement().value }
			this._socket.emit('ConsoleCommand', message, bind(this, this._handleResponse))
		}))
	}
	
	this._handleResponse = function(err, response) {
		this._output.append(DIV('response ' + (err ? 'error' : 'message'), (response || err).toString()))
	}
})

new Console(io.connect('/consoles')).appendTo(document.body)
