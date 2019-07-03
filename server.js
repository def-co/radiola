"use strict";

const fs = require('fs'),
      http = require('http'),
      { handler } = require('./lib/server');

const server = http.createServer(handler);
server.listen('/run/p22-radiola/http-api.sock');

process.on('SIGTERM', () => {
  server.close(() => {
    fs.unlinkSync('/run/p22-radiola/http-api.sock');
  });
});
