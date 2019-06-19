"use strict";

const http = require('http'),
      { finders } = require('./song_finder'),
      { EventStream } = require('./http/event_stream');

const server = http.createServer((req, res) => {
  let url = new URL(req.url, 'http://dummy'),
      path = url.pathname;
  if ( ! path.startsWith('/discover')) {
    res.statusCode = 404;
    res.end('404 page not found');
    return;
  }

  let stream = new EventStream(res);

  const listener = ({ song }) => {
    stream.emit({ event: 'song', data: JSON.stringify(song) });
  };
  finders.swh.subscribe(listener);

  res.on('close', () => {
    finders.swh.unsubscribe(listener);
  });
});

server.listen(() => {
  console.log('listening on %j', server.address());
});
