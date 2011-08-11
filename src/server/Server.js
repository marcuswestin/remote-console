var express = require('express'),
	socketIO = require('socket.io'),
	Class = require('std/Class'),
	bind = require('std/bind'),
	each = require('std/each'),
	fs = require('fs'),
	requireServer = require('require/server'),
	unique = require('std/unique'),
	time = require('std/time')

module.exports = Class(function() {
	
	this._sessionTimeout = 30 + time.seconds
	
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
			
			._route('/test/', bind(this, this._serveFile, 'src/client/test.html', 'text/html'))
			._route('/test', redirect('/test/'))

			._route('/client.js', bind(this, this._serveFile, 'build/client.js', 'application/javascript'))
			._route('/client/', bind(this, this._serveFile, 'src/client/client.html', 'text/html'))
			._route('/client', redirect('/client/'))
			
			._route('/console/console.css', bind(this, this._serveFile, 'src/console/console.css', 'text/css'))
			._route('/console/console.js', bind(this, this._serveFile, 'build/console.js', 'text/css'))
			._route('/console/', bind(this, this._serveFile, 'src/console/console.html', 'text/html'))
			._route('/console', redirect('/console/'))
			
			._route('/require/*', bind(requireServer, requireServer.handleRequest))
	}
	
	this._route = function(route, handler) {
		this._app.get(route, bind(this, handler))
		return this
	}
	
	this._serveFile = function(path, contentType, req, res, next) {
		fs.readFile(__dirname + '/../../' + path, 'utf8', function(err, content) {
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
			.on('CommandResponse', bind(this, this._onCommandResponse, socketID))
			.on('disconnect', bind(this, this._onClientDisconnect, socketID))
			.on('ClientEvent', bind(this, this._registerClientEvent, socketID))
	}
	
	this._onClientDisconnect = function(socketID) {
		delete this._clientSockets[socketID]
		this._withSession(socketID, function(session) {
			this._registerSessionEvent(session, { type:'tab-disconnect', socketID:socketID })
			this._removeSessionSocket(session.sockets, socketID)
			delete this._socketToSession[socketID]
			this._scheduleCheckSession(session)
		})
	}
	
	this._removeSessionSocket = function(socketIDs, targetSocketID) {
		for (var i=0, socketID; socketID = socketIDs[i]; i++) {
			if (socketID != targetSocketID) { continue }
			socketIDs.splice(i, 1)
			break
		}
	}
	
	this._sessionTimeouts = {}
	this._scheduleCheckSession = function(session) {
		var timeout = this._sessionTimeouts[session.id]
		if (timeout) { clearTimeout(timeout) }
		this._sessionTimeouts[session.id] = setTimeout(bind(this, function() {
			delete this._sessionTimeouts[session.id]
			if (session.sockets.length) { return }
			this._broadcast('SessionDead', session)
			delete this._sessions[session.id]
			delete this._sessionEvents[session.id]
		}), this._sessionTimeout)
	}

	this._createClientSession = function(socketID, clientInfo, callback) {
		// todo read navigator out of clientInfo
		var randomColor = '#'+(0x1000000+(Math.random())*0xffffff).toString(16).substr(1,6),
			session = { id:new Date().getTime()+'-'+Math.random(), clientInfo:clientInfo, sockets:[socketID], color:randomColor }
		this._sessions[session.id] = session
		this._sessionEvents[session.id] = []
		this._socketToSession[socketID] = session
		callback(session.id)
		this._broadcast('SessionInfo', session)
	}
	
	this._registerSessionClient = function(socketID, sessionID, callback) {
		var session = this._sessions[sessionID]
		if (session) {
			this._socketToSession[socketID] = session
			session.sockets.push(socketID)
			callback(true)
			this._broadcast('SessionInfo', session)
		} else {
			console.log("REGISTER BAD SESSION", socketID, sessionID)
			callback(false)
		}
	}
	
	this._withSession = function(socketID, callback) {
		var session = this._socketToSession[socketID]
		if (!session) { return }
		callback.call(this, session)
	}
	
	this._withSessionSockets = function(session, callback) {
		if (!session) { return }
		each(session.sockets, this, function(socketID) {
			callback.call(this, this._clientSockets[socketID])
		})
	}
	
	this._registerClientEvent = function(socketID, clientEvent) {
		var session = this._socketToSession[socketID]
		if (!session) {
			console.error("BAD SESSION", socketID)
			return
		}
		clientEvent.socketID = socketID
		this._registerSessionEvent(session, clientEvent)
	}
	
	this._registerSessionEvent = function(session, clientEvent) {
		if (!session) { return console.log("BAD SESSION", new Error().stack) }
		clientEvent.sessionID = session.id
		clientEvent.args = clientEvent.args || []
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
		each(this._sessions, this, function(session) {
			consoleSocket.emit('SessionInfo', session)
			each(this._sessionEvents[session.id], function(clientEvent) {
				consoleSocket.emit('ClientEvent', clientEvent)
			})
		})
	}

	this._handleConsoleCommand = function(message, callback) {
		var commandID = unique(),
			session = this._sessions[message.sessionID]
		this._registerSessionEvent(session, { type:'command', args:[message.command], commandID:commandID })
		this._withSessionSockets(session, function(clientSocket) {
			clientSocket.emit('ExecuteCommand', { command:message.command, commandID:commandID })
		})
	}
	
	this._onCommandResponse = function(socketID, response) {
		this._withSession(socketID, function(session) {
			this._registerSessionEvent(session, { type:'response', commandID:response.commandID, args:[response.err, response.value] })
		})
	}
	
	this._broadcast = function(event, data) {
		each(this._consoleSockets, function(consoleSocket) {
			consoleSocket.emit(event, data)
		})
	}	
})
