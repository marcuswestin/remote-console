#!/usr/bin/env node

var requireCompiler = require('require/compiler'),
	fs = require('fs')

requireCompiler.addReplacement("'object' === typeof module ? module.exports : (window.io = {})", "window.io = {}")
// requireCompiler.setOpts({ path: __dirname, root: 'require', port: port, host: 'localhost' })

try { fs.mkdirSync(__dirname + '/../build', '755') } catch(e) { }
fs.writeFileSync(__dirname + '/../build/client.js', requireCompiler.compile(__dirname + '/client/client.js', { minify:false, ascii_only:true }))
fs.writeFileSync(__dirname + '/../build/console.js', requireCompiler.compile(__dirname + '/console/console.js', { minify:false, ascii_only:true }))
