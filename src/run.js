#!/usr/bin/env node

var Server = require('./server/Server')

new Server().listen(8080)