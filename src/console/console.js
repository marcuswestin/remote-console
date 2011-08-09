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
	}
	
	this._renderClient = function(client) {
		var node = DIV('client', client.id).appendTo(this._clientList)
		this._clients[client.id] = node
	}
	
	this._removeClient = function(client) {
		this._clients[client.id].remove()
		delete this._clients[client.id]
	}
})

new Console(io.connect('/consoles')).appendTo(document.body)
