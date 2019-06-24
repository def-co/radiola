"use strict";

const http = require('http'),
      { handler } = require('./lib/server');

const server = http.createServer(handler);
server.listen('/run/p22-radiola/http-api.sock');
