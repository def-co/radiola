import * as http from 'node:http';
import * as net from 'node:net';
import { type Readable as ReadableStream } from 'node:stream';
import { type TStationID } from './types';
import STREAM_URLS from './stream_urls';
import { deferred, sleep, awaitEvent, TimeoutError } from './util';

type HandleChunk = (chunk: Buffer) => void;
type HandleClose = () => void;
type Subscriber = [HandleChunk, HandleClose];

type Unsubscriber = () => void;

function readUntilCrlf(stream: ReadableStream, timeout: number): Promise<Buffer> {
  const { promise, resolve, reject} = deferred<Buffer>();

  let buffer = Buffer.allocUnsafe(1024);
  let i = 0;

  const handleData = (chunk: Buffer) => {
    if (i + chunk.length > buffer.length) {
      let prevBuffer = buffer;
      buffer = Buffer.allocUnsafe(buffer.length * 2);
      prevBuffer.copy(buffer);
    }
    chunk.copy(buffer, i);
    i += chunk.length;

    let pos = buffer.indexOf('\r\n\r\n', 0, 'ascii');
    if (pos !== -1) {
      resolve(buffer.subarray(0, i));
    }
  };
  const handleError = (err) => {
    reject(err);
  };
  const handleEnd = () => {
    reject(new Error('short read'));
  };

  stream.on('data', handleData);
  stream.once('error', handleError);
  stream.once('end', handleEnd);

  let timer = sleep(timeout);
  timer.then(() => {
    reject(new TimeoutError());
  }, () => {});

  const cleanup = () => {
    stream.removeListener('data', handleData);
    stream.removeListener('error', handleError);
    stream.removeListener('end', handleEnd);
    timer.cancel();
  }
  promise.finally(cleanup);

  return promise;
}

let connections = new Map<TStationID, Connection>();
class Connection {
  static instances = new Map<TStationID, Connection>();

  id: TStationID;
  setupPromise: Promise<Connection> | null;
  socket: net.Socket | null;
  subscribers: Set<Subscriber>;
  lastBuffer: Buffer | null;

  constructor(id: TStationID) {
    this.id = id;
    this.setupPromise = null;
    this.socket = null;
    this.subscribers = new Set();
    this.lastBuffer = null;

    Connection.instances.set(id, this);

    this.setupPromise = this.setup();
  }

  teardown() {
    if (this.socket !== null) {
      this.socket.destroy();
      this.socket = null;
    }
    for (let [_, close] of this.subscribers) {
      close();
    }
    Connection.instances.delete(this.id);
  }

  static getOrConnect(id: TStationID): Promise<Connection> {
    if (Connection.instances.has(id)) {
      return Promise.resolve(Connection.instances.get(id)!);
    }

    if ( ! (id in STREAM_URLS)) {
      return Promise.reject(new Error('id not found'));
    }

    return new Connection(id).setupPromise!;
  }

  async setup(): Promise<Connection> {
    let url = new URL(STREAM_URLS[this.id]!);
    this.socket = net.connect({
      host: url.hostname,
      port: Number(url.port ?? '80'),
    });
    try {
      await awaitEvent(this.socket, 'connect', { timeout: 5000 });
    } catch (e) {
      this.teardown();
      throw e;
    }

    this.socket.write([
      `GET ${url.pathname}${url.search} HTTP/1.1`,
      `host: ${url.hostname}`,
      `user-agent: radiola.minire/v1.0 (+https://pn.id.lv/)`,
      `connection: close`,
      ``,
      ``,
    ].join('\r\n'));
    this.socket.end();

    let packet: Buffer;
    try {
      packet = await readUntilCrlf(this.socket, 5000);
    } catch (e) {
      this.teardown();
      throw e;
    }

    let endOfHeader = packet.indexOf('\r\n\r\n', 0, 'ascii');
    if (endOfHeader === -1) {
      this.teardown();
      throw new Error('unexpected initial packet: HTTP header boundary missing');
    }

    this.socket.on('data', (chunk) => this.handleData(chunk));
    this.socket.on('close', () => this.teardown());
    this.socket.on('error', (err) => {
      // TODO report error to sentry
    });

    this.handleData(packet.subarray(endOfHeader + 4));
    this.setupPromise = null;
    return this;
  }

  handleData(chunk: Buffer) {
    this.lastBuffer = chunk;
    for (let [sub, _] of this.subscribers) {
      sub(chunk);
    }
  }

  addSubscriber(sub: Subscriber): Unsubscriber {
    if (this.lastBuffer !== null) {
      sub[0](this.lastBuffer);
    }
    this.subscribers.add(sub);
    return () => {
      sub[1]();
      this.subscribers.delete(sub);
      if (this.subscribers.size === 0) {
        this.teardown();
      }
    };
  }
}

export function subscribe(
  id: TStationID,
  onChunk: HandleChunk,
  onClose: HandleClose,
): Promise<Unsubscriber> {
  return Connection.getOrConnect(id).then((conn) => {
    return conn.addSubscriber([onChunk, onClose]);
  }, (err) => {
    throw err;
  });
}

