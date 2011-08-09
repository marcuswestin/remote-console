require('socket.io/node_modules/socket.io-client/dist/socket.io') // exposes "io" globally

var socket = io.connect('/consoles')
socket.on('Client', function (data) {
  console.log('Client', data)
})
