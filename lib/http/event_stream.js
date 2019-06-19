"use strict";

const KEEPALIVE_INTERVAL = 27500,
      NEWLINE_REGEX = /\n/g;

const http = require('http');

class EventStream {
  constructor(stream) {
    this.stream = stream;
    this._alive = true;

    let keepaliveInterval = setInterval(() => {
      this.emit({ comment: true });
    }, KEEPALIVE_INTERVAL);

    stream.once('close', () => {
      this._alive = false;
      clearInterval(keepaliveInterval);
    });

    if (stream instanceof http.ServerResponse) {
      stream.setHeader('Content-Type', 'text/event-stream');
      this.emit({ comment: true });
    }
  }

  emit({ comment, event, data, id, retry }) {
    let lines = [ ];
    if (comment !== undefined) {
      if (comment === true) {
        lines.push(':');
      } else {
        lines.push(`: ${comment}`);
      }
    }
    if (event !== undefined) {
      lines.push(`event: ${event}`);
    }
    if (data !== undefined) {
      data = data.replace(NEWLINE_REGEX, '\ndata: ');
      lines.push(`data: ${data}`);
    }
    if (id !== undefined) {
      lines.push(`id: ${id}`);
    }
    if (retry !== undefined) {
      lines.push(`retry: ${retry}`);
    }

    if (lines.length !== 0 && lines[0] !== ':') {
      lines.push('');
    }
    lines.push('');

    let payload = lines.join('\n');

    return new Promise((resolve, reject) => {
      this.stream.write(payload, 'UTF-8', (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

exports.EventStream = EventStream;
