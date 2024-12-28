import * as http from 'node:http';
import 'dotenv/config';
import * as dotenv from 'dotenv';

import { type TStationID } from './types';
import STREAM_URLS from './stream_urls';
import { subscribe } from './client';

if (
   ! process.env.MINIRE_HOST
   || ! process.env.MINIRE_PORT
) {
  console.error('Must define env variables MINIRE_HOST, MINIRE_PORT');
  process.exit(1);
}

require('./sentry');

enum ConnState {
  WAITING_ON_UPSTREAM,
  LIVE,
  CLOSED,
}

const server = http.createServer((req, res) => {
  let stationId = new URL('http://dummy' + req.url).pathname.replace(/^\/+/, '');
  if ( ! (stationId in STREAM_URLS)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=UTF-8' });
    res.end('not found\n');
    return;
  }

  let state = ConnState.WAITING_ON_UPSTREAM;

  let unsubscribe: () => void | undefined;
  const handleData = (chunk: Buffer) => {
    if (state === ConnState.WAITING_ON_UPSTREAM) {
      res.writeHead(200, {
        'content-type': 'audio/mpeg',
      });
      state = ConnState.LIVE;
    }

    res.write(chunk);
  };
  const handleClose = () => {
    res.end();
    state = ConnState.CLOSED;
  };

  subscribe(stationId, handleData, handleClose)
    .then((unsubscribe_) => {
      if (state === ConnState.CLOSED) {
        unsubscribe_();
      } else {
        unsubscribe = unsubscribe_;
      }
    }, () => {
      state = ConnState.CLOSED;
      res.writeHead(502, {
        'content-type': 'text/plain; charset=UTF-8',
      });
      res.end('could not connect to upstream\n');
    });

  req.once('close', () => {
    state = ConnState.CLOSED;
    if (unsubscribe !== undefined) {
      unsubscribe();
    }
  });
});
server.listen(Number(process.env.MINIRE_PORT), process.env.MINIRE_HOST, () => {
  console.log('listening', server.address());
});
