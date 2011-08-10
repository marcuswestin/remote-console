var store = require('store'),
	Class = require('std/Class'),
	bind = require('std/bind')

require('socket.io/node_modules/socket.io-client/dist/socket.io') // exposes "io" globally

module.exports = Class(function () {
	
	this._storeName = 'remoteConsoleSession'
	
	this.connect = function(callback) {
		if (!callback) { throw new Error("Session#connect requires a callback") }
		if (this._connectCallback) { throw new Error("Session#connect called twice") }
		this._connectCallback = callback
		this._socket = io.connect('/clients')
		this._socket.on('connect', bind(this, this._onConnect))
		this._socket.on('BadSession', bind(this, this._onBadSession))
	}
	
	this._onBadSession = function() {
		store.remove(this._storeName)
		alert("We had a bad remote console session ID - please reload the page")
	}
	
	this._onConnect = function() {
		var sessionInfo = store.get(this._storeName)
		if (sessionInfo) { return this._connectCallback() }
		var clientInfo = {}
		this._socket.emit('CreateSession', clientInfo, bind(this, function(session) {
			store.set(this._storeName, session)
			this._connectCallback()
		}))
	}
	
	this.registerEvent = function(type, data) {
		this._socket.emit('ClientEvent', { type:type, data:data })
	}
	
	this.on = function() { this._socket.on.apply(this._socket, arguments) }
})