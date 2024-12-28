import * as EventEmitter from 'node:events';

export type Deferred<T> = {
  promise: Promise<T>,
  resolve: (val: T) => void,
  reject: (err: any) => void,
};

export function deferred<T>(): Deferred<T> {
  let resolve: Deferred<T>["resolve"];
  let reject: Deferred<T>["reject"];
  let promise = new Promise<T>((resolve_, reject_) => {
    resolve = resolve_;
    reject = reject_;
  });
  return { promise, resolve: resolve!, reject: reject! };
}

export interface Cancelable {
  cancel(): void;
}
export type CancelablePromise<T> = Promise<T> & Cancelable;

export class CancelledError extends Error {}
export class TimeoutError extends Error {}

function withCancellation<T>(promise: Promise<T>, cancelFunction: () => void): CancelablePromise<T> {
  let promise_ = promise as CancelablePromise<T>;
  promise_.cancel = cancelFunction;
  return promise_;
}

type AwaitEventOptions = {
  withError?: boolean,
  timeout?: number,
}
export function awaitEvent(
  target: EventEmitter,
  event: string,
  { withError, timeout }: AwaitEventOptions,
): CancelablePromise<any> {
  const { promise, resolve, reject } = deferred<any>();

  let timeoutPromise: CancelablePromise<void> | undefined;

  const cleanup = () => {
    target.removeListener(event, handleEvent);
    if (withError) {
      target.removeListener('error', handleError);
    }
    if (timeoutPromise !== undefined) {
      timeoutPromise.cancel();
    }
  };

  const handleEvent = (param: any) => {
    resolve(param);
  };
  const handleError = (err: any) => {
    reject(err);
  };

  target.once(event, handleEvent);
  if (withError) {
    target.once('error', handleError);
  }
  if (timeout !== undefined) {
    timeoutPromise = sleep(timeout);
    timeoutPromise.then(() => {
      reject(new TimeoutError());
    });
  }

  return withCancellation(promise.finally(cleanup), () => {
    reject(new CancelledError());
  });
}

export function sleep(timeout: number): CancelablePromise<void> {
  const { promise, resolve } = deferred<void>();
  let timer = setTimeout(resolve, timeout);
  return withCancellation(promise, () => {
    clearTimeout(timer);
  });
}
