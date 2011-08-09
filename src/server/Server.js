var express = require('express'),
	socketIO = require('socket.io'),
	Class = require('std/Class'),
	bind = require('std/bind'),
	each = require('std/each'),
	fs = require('fs'),
	requireServer = require('require/server')

module.exports = Class(function() {
	
	this.init = function() {
		this._clientSockets = {}
		this._consoleSockets = {}
		
		this._app = express.createServer()
		this
			._route('/client', bind(this, this._serveFile, 'src/client/client.html', 'text/html'))
			._route('/console', bind(this, this._serveFile, 'src/console/console.html', 'text/html'))
			._route('/require/*', bind(requireServer, requireServer.handleRequest))
		
		var io = socketIO.listen(this._app)
		io.of('/clients').on('connection', bind(this, this._onClientConnect))
		io.of('/consoles').on('connection', bind(this, this._onConsoleConnect))
	}
	
	this.listen = function(port) {
		requireServer.addReplacement("'object' === typeof module ? module.exports : (window.io = {})", "window.io = {}")
		requireServer.setOpts({
			path: __dirname + '/../',
			root: 'require',
			port: port,
			host: 'localhost'
		})
		
		this._app.listen(port)
	}
	
	this._route = function(route, handler) {
		this._app.get(route, bind(this, handler))
		return this
	}
	
	this._serveFile = function(path, contentType, req, res, next) {
		fs.readFile(path, 'utf8', function(err, content) {
			if (err) {
				res.writeHead(400)
				res.end()
				return
			}
			res.writeHead(200, { 'Content-Type':contentType })
			res.end(content)
		})
	}
	
	this._onClientConnect = function(clientSocket) {
		this._clientSockets[clientSocket.id] = clientSocket
		each(this._consoleSockets, function(consoleSocket) {
			consoleSocket.emit('ClientConnect', { id:clientSocket.id })
		})
		clientSocket.on('disconnect', bind(this, this._onClientDisconnect, clientSocket))
	}
	
	this._onClientDisconnect = function(clientSocket) {
		delete this._clientSockets[clientSocket.id]
		each(this._consoleSockets, function(consoleSocket) {
			consoleSocket.emit('ClientDisconnect', { id:clientSocket.id })
		})
	}
	
	this._onConsoleConnect = function(consoleSocket) {
		this._consoleSockets[consoleSocket.id] = consoleSocket
		each(this._clientSockets, function(clientSocket) {
			consoleSocket.emit('ClientConnect', { id:clientSocket.id })
		})
		consoleSocket
			.on('ConsoleCommand', bind(this, this._handleConsoleCommand))
			.on('disconnect', bind(this, this._onConsoleDisconnect, consoleSocket))
	}
	
	this._handleConsoleCommand = function(message, callback) {
		this._clientSockets[message.clientID].emit('ClientCommand', message.command, function(err, response) {
			callback(err, response)
		})
	}
	
	this._onConsoleDisconnect = function(consoleSocket) {
		delete this._consoleSockets[consoleSocket.id]
	}
})
