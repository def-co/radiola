"use strict";

const { finders } = require('./song_finder'),
      { EventStream } = require('./http/event_stream');

function notFound(res) {
  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
  res.end('Sorry, not found.\n');
}

exports.handler = (req, res) => {
  let url = new URL(req.url, 'http://dummy'),
      path = url.pathname;

  if (path.startsWith('/discover/current/')) {
    let station = path.slice(18);
    if ( ! (station in finders)) {
      return notFound(res);
    }
    let finder = finders[station];
    finder.findStateOnce().then((song) => {
      res.setHeader('Content-Type', 'application/json; charset=UTF-8');
      res.end(JSON.stringify(song) + '\n');
    }, (err) => {
      console.log('Finding song once failed:', err);
      res.statusCode = 500;
      res.end();
    });
    return;
  }

  if (path.startsWith('/discover/subscribe/')) {
    let station = path.slice(20);
    if ( ! (station in finders)) {
      return notFound(res);
    }
    let finder = finders[station],
        stream = new EventStream(res);

    const listener = ({ song, program }) => {
      if (song) {
        stream.emit({
          event: 'song',
          data: JSON.stringify(song),
        });
      }
      if (program) {
        stream.emit({
          event: 'program',
          data: JSON.stringify(program),
        });
      }
    };

    finder.subscribe(listener);

    req.on('close', () => {
      finder.unsubscribe(listener);
      res.end();
    });

    return;
  }

  notFound(res);
}

