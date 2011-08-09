(function(){
	require('socket.io/node_modules/socket.io-client/dist/socket.io') // exposes "io" globally

	io.connect('/clients').on('ClientCommand', function (command, callback) {
		try {
			callback(null, eval(command))
		} catch(error) {
			callback(error)
		}
	})
	
})()