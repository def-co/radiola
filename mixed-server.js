"use strict";

const http = require('http'),
      fs = require('fs'),
      path = require('path');

const MIME_TYPES = {
  '.html': 'text/html', '.htm': 'text/html',
  '.txt': 'text/plain',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image.jpeg',
  '.gif': 'image/gif',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.woff': 'application/font-woff',
  '.ttf': 'application/font-ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'application/font-otf',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
};

const { handler } = require('./lib/server');

const server = http.createServer((req, res) => {
  let url = new URL(req.url, 'http://dummy'), urlPath = url.pathname;
  if (urlPath === '/') {
    urlPath = '/index.html';
  }

  let file = path.join(__dirname, 'public', urlPath);
  let extname = String(path.extname(file)).toLowerCase();
  let mimetype;
  if (extname in MIME_TYPES) {
    mimetype = MIME_TYPES[extname];
  } else {
    mimetype = 'application/octet-stream';
  }

  fs.readFile(file, function(error, content) {
    if (error) {
      if (error.code === 'ENOENT') {
        return handler(req, res);
      }
      res.statusCode = 500;
      res.end('Sorry, something went wrong.\n');
      return;
    }

    res.setHeader('Content-Type', mimetype);
    res.end(content);
  });
});

server.listen(() => {
  console.log('listening on %j', server.address());
});
