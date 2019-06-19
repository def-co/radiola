"use strict";

const http = require('http'),
      { handler } = require('./lib/server');

const server = http.createServer(handler);
server.listen('/var/run/p22-radiola/http-api.sock');
