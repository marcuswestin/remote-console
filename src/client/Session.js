var store = require('store'),
	Class = require('std/Class'),
	bind = require('std/bind'),
	client = require('std/client')

require('socket.io/node_modules/socket.io-client/dist/socket.io') // exposes "io" globally

module.exports = Class(function () {
	
	this._storeName = 'remoteConsoleSession'
	
	this.connect = function(callback) {
		if (!callback) { throw new Error("Session#connect requires a callback") }
		if (this._connectCallback) { throw new Error("Session#connect called twice") }
		this._connectCallback = callback
		this._socket = io.connect('/clients')
		this._socket.on('connect', bind(this, this._onConnect))
	}
	
	this._onConnect = function() {
		var sessionID = store.get(this._storeName)
		if (!sessionID) { return this._createSession() }
		this._socket.emit('RegisterSessionClient', sessionID, bind(this, function(session) {
			if (session) { return this._connectCallback() }
			store.remove(this._storeName)
			this._createSession()
		}))
	}
	
	this._createSession = function() {
		var clientInfo = { name:client.name || 'Unknown', version:client.version }
		this._socket.emit('CreateSession', clientInfo, bind(this, function(sessionID) {
			store.set(this._storeName, sessionID)
			this._connectCallback()
		}))
	}
	
	this.registerEvent = function(type, data) {
		this._socket.emit('ClientEvent', { type:type, data:data })
	}
	
	this.on = function() { this._socket.on.apply(this._socket, arguments) }
})