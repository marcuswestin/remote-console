var store = require('store')

module.exports = function getSession() {
	var storeName = 'remoteConsoleSession',
		session = store.get(storeName)
	if (!session) {
		session = { id:new Date().getTime()+'-'+Math.random() }
		store.set(storeName, session)
	}
	return session
}