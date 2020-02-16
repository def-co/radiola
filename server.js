"use strict";

const fs = require('fs'),
      http = require('http'),
      { handler } = require('./lib/server');

let connections = [ ];

const server = http.createServer(handler);
server.on('connection', (socket) => {
  connections.push(socket);
  socket.on('close', () => {
    let index = connections.indexOf(socket);
    if (index !== -1) {
      connections.splice(index, 1);
    }
  });
});
server.listen('/run/p22-radiola/http-api.sock');

process.on('SIGTERM', () => {
  let quitTimeout = setTimeout(() => {
    connections.forEach((socket) => {
      socket.end();
    });
    server.close();
    server.unref();
  }, 1000);
  server.close(() => {
    clearTimeout(quitTimeout);
  });
});
