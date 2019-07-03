"use strict";

const MAX_ERROR_THRESHOLD = 7,
      BACKOFF_PERIOD_MS = 100,
      REQUEST_INTERVAL_MS = 9000,
      CACHE_VALIDITY_PERIOD_MS = 90 * 1000;

function recursiveEquals(a, b) {
  if (typeof a !== typeof b) {
    return false;
  }

  switch (typeof a) {
    case 'bigint':
    case 'boolean':
    case 'number':
    case 'string':
    case 'undefined': return a === b;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }

    for (let i = 0, l = a.length; i < l; i += 1) {
      if ( ! recursiveEquals(a[i], b[i])) {
        return false;
      }
    }

    return true;
  }

  let keysA = Object.keys(a).sort(),
      keysB = Object.keys(b).sort();

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (let i = 0, l = keysA.length; i < l; i += 1) {
    let key = keysA[i];
    if (keysB[i] !== key) {
      return false;
    }

    let valA = a[key], valB = b[key];
    if ( ! recursiveEquals(valA, valB)) {
      return false;
    }
  }

  return true;
}

class Finder {
  constructor() {
    this._lastState = null;
    this._subscribers = [ ];
    this._nextTimeout = null;
    this._cacheInvalidationTimeout = null;

    this.refreshIntervalBase = REQUEST_INTERVAL_MS;
    this.refreshIntervalJitter = REQUEST_INTERVAL_MS * (2/3);
  }

  _computeNextTimeout(errorCount) {
    let ms = this.refreshIntervalBase +
      Math.round(Math.random() * this.refreshIntervalJitter);
    if (errorCount > MAX_ERROR_THRESHOLD) {
      // TODO: log
      errorCount = MAX_ERROR_THRESHOLD;
    }
    if (errorCount > 0) {
      ms += (2 ** errorCount) * BACKOFF_PERIOD_MS;
    }
    return ms;
  }

  subscribe(listener) {
    this._subscribers.push(listener);
    if (this._nextTimeout === null) {
      this._start();
    }
    if (this._lastState !== null) {
      listener(this._lastState);
    }
  }

  unsubscribe(listener) {
    let index = this._subscribers.indexOf(listener);
    if (index !== -1) {
      this._subscribers.splice(index, 1);
    }
  }

  forceRefresh() {
    return this.getCurrentState().then((state) => {
      return this.processState(state);
    });
  }

  _start() {
    let errorCount = 0;

    const poll = () => {
      this.getCurrentState().then((state) => {
        errorCount = 0;
        return this.processState(state);
      }, (error) => {
        // TODO: log better
        errorCount += 1;
      }).then(() => {
        if (this._subscribers.length === 0) {
          this._nextTimeout = null;
        } else {
          let ms = this._computeNextTimeout(errorCount);
          this._nextTimeout = setTimeout(poll, ms);
        }
      });
    };

    poll();
  }

  processState(state) {
    if (this._cacheInvalidationTimeout !== null) {
      clearTimeout(this._cacheInvalidationTimeout);
    }

    let subs = this._subscribers.slice();
    for (let i = 0, l = subs.length; i < l; i += 1) {
      subs[i](state);
    }
    this._lastState = state;
    this._cacheInvalidationTimeout = setTimeout(() => {
      this._lastState = this._cacheInvalidationTimeout = null;
    }, CACHE_VALIDITY_PERIOD_MS);

    return state;
  }

  findStateOnce() {
    if (this._lastState !== null) {
      return Promise.resolve(this._lastState);
    }
    return this.forceRefresh();
  }

  getCurrentState() {
    throw new Error('Finder#getCurrentState must be implemented');
  }
}
exports.Finder = Finder;
