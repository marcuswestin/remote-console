require('socket.io/node_modules/socket.io-client/dist/socket.io') // exposes "io" globally

var socket = io.connect('/clients')
socket.on('Command', function (data) {
	console.log("Command", data)
})
