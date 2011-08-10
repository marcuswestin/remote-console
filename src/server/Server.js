var express = require('express'),
	socketIO = require('socket.io'),
	Class = require('std/Class'),
	bind = require('std/bind'),
	each = require('std/each'),
	fs = require('fs'),
	requireServer = require('require/server'),
	time = require('std/time')

module.exports = Class(function() {
	
	this._sessionTimeout = 10 + time.seconds
	
	this.init = function() {
		this._sessions = {}
		this._sessionEvents = {}
		this._socketToSession = {}
		this._clientSockets = {}
		this._consoleSockets = {}
		
		this._app = express.createServer()
		this._setupHTTPRoutes()
		this._setupSocketRoutes()
	}
	
	this.listen = function(port) {
		requireServer.addReplacement("'object' === typeof module ? module.exports : (window.io = {})", "window.io = {}")
		requireServer.setOpts({ path: __dirname + '/../', root: 'require', port: port, host: 'localhost' })
		this._app.listen(port)
	}
	
	/* HTTP routing
	 **************/
	this._setupHTTPRoutes = function() {
		function redirect(path) {
			return function(req, res) { res.redirect(path) }
		}
		this
			._route('/', redirect('/console/'))
			
			._route('/client/', bind(this, this._serveFile, 'src/client/client.html', 'text/html'))
			._route('/client', redirect('/client/'))
			
			._route('/console/console.css', bind(this, this._serveFile, 'src/console/console.css', 'text/css'))
			._route('/console/', bind(this, this._serveFile, 'src/console/console.html', 'text/html'))
			._route('/console', redirect('/console/'))
			
			._route('/require/*', bind(requireServer, requireServer.handleRequest))
	}
	
	this._route = function(route, handler) {
		this._app.get(route, bind(this, handler))
		return this
	}
	
	this._serveFile = function(path, contentType, req, res, next) {
		fs.readFile(path, 'utf8', function(err, content) {
			if (err) { res.writeHead(400); res.end(); return }
			res.writeHead(200, { 'Content-Type':contentType })
			res.end(content)
		})
	}
	
	/* Socket routing
	 ****************/
	this._setupSocketRoutes = function() {
		var io = socketIO.listen(this._app)
		io.of('/clients').on('connection', bind(this, this._onClientSocket))
		io.of('/consoles').on('connection', bind(this, this._onConsoleSocket))
	}
	
	/* Client sessions and sockets
	 *****************************/
	this._onClientSocket = function(clientSocket) {
		var socketID = clientSocket.id
		this._clientSockets[socketID] = clientSocket
		
		clientSocket
			.on('CreateSession', bind(this, this._createClientSession, socketID))
			.on('RegisterSessionClient', bind(this, this._registerSessionClient, socketID))
			.on('disconnect', bind(this, this._onClientDisconnect, socketID))
			.on('ClientEvent', bind(this, this._onClientEvent, socketID))
		
		this._withSession(socketID, bind(this, this._scheduleCheckSession))
	}
	
	this._onClientDisconnect = function(socketID) {
		delete this._clientSockets[socketID]
		this._withSession(socketID, bind(this, function(session) {
			this._removeSessionSocket(session.sockets, socketID)
			delete this._socketToSession[socketID]
			this._scheduleCheckSession(session)
		}))
	}
	
	this._removeSessionSocket = function(sockets, socketID) {
		for (var i=0, socket; socket = sockets[i]; i++) {
			if (socket.id != socketID) { continue }
			sockets.splice(i, 1)
			break
		}
	}
	
	this._scheduleCheckSession = function(session) {
		if (session.timeout) { clearTimeout(session.timeout) }
		session.timeout = setTimeout(bind(this, function() {
			if (session.tabs) { return }
			this._broadcast('SessionDead', session)
		}), this._sessionTimeout)
	}

	this._createClientSession = function(socketID, clientInfo, callback) {
		// todo read navigator out of clientInfo
		var session = { id:new Date().getTime()+'-'+Math.random(), navigator:'Unknown', sockets:[socketID] }
		this._sessions[session.id] = session
		this._sessionEvents[session.id] = []
		this._socketToSession[socketID] = session
		callback(session.id)
		this._broadcast('SessionInfo', session)
	}
	
	this._registerSessionClient = function(socketID, sessionID, callback) {
		var session = this._sessions[sessionID]
		callback(!!session)
	}
	
	this._withSession = function(socketID, callback) {
		var session = this._socketToSession[socketID]
		if (!session) { return }
		callback(session)
	}
	
	this._withSessionSockets = function(sessionID, callback) {
		var session = this._sessions[sessionID]
		if (!session) { return }
		each(session.sockets, callback)
	}
	
	this._onClientEvent = function(socketID, clientEvent) {
		var session = this._sessions[socketID]
		if (!session) { return this._clientSockets[socketID].emit('BadSession') }
		clientEvent.sessionID = session.id
		this._sessionEvents[session.id].push(clientEvent)
		this._broadcast('ClientEvent', clientEvent)
	}
	
	/* Console connections
	 *********************/
	this._onConsoleSocket = function(consoleSocket) {
		var socketID = consoleSocket.id
		this._consoleSockets[socketID] = consoleSocket

		consoleSocket
			.on('ExecuteClientCommand', bind(this, this._handleConsoleCommand))
			.on('disconnect', bind(this, function() { delete this._consoleSockets[socketID] }))

		// Send events to console to catch up with current state of all sessions
		each(this._sessions, function(session) {
			consoleSocket.emit('SessionInfo', session)
			each(this._sessionEvents[session.id], function(clientEvent) {
				consoleSocket.emit('ClientEvent', clientEvent)
			})
		})
	}

	this._handleConsoleCommand = function(message, callback) {
		this._withSessionSockets(message.sessionID, function(clientSocket) {
			clientSocket.emit('ExecuteClientCommand', message.command, function(data) {
				this._broadcast('Response', { response:response, requestID:message.requestID })
			})
		})
	}
	
	this._broadcast = function(event, data) {
		console.log("BROADCAST", event, data)
		each(this._consoleSockets, function(consoleSocket) {
			consoleSocket.emit(event, data)
		})
	}	
})
