"use strict";

const MAX_ERROR_THRESHOLD = 7,
      BACKOFF_PERIOD_MS = 100,
      REQUEST_INTERVAL_MS = 9000,
      VALIDITY_CACHE_RATIO = 5/4;

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

class CachedContainer {
  constructor() {
    this.isValid = false;
    this._data = undefined;
    this._invalidationTimeout = null;
  }

  get(evenIfStale = false) {
    if ( ! evenIfStale && ! this.isValid) {
      return undefined;
    }
    return this._data;
  }

  set(data, validFor) {
    this.isValid = true;
    this._data = data;
    this.refresh(validFor);
  }

  refresh(validFor) {
    if (this._invalidationTimeout !== null) {
      clearTimeout(this._invalidationTimeout);
    }

    this._invalidationTimeout = setTimeout(() => {
      this.isValid = false;
      this._invalidationTimeout = null;
    }, validFor);
  }
}

class Finder {
  constructor() {
    this._lastState = new CachedContainer();
    this._subscribers = [ ];
    this._nextTimeout = null;

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
    if (this._lastState.isValid) {
      let state = this._lastState.get();
      listener(state);
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
        console.log('Warning: song finder failed: %s', error);
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
    let cacheValidityPeriod = VALIDITY_CACHE_RATIO *
      (this.refreshIntervalBase + this.refreshIntervalJitter);

    let previousState = this._lastState.get(true);

    if ( ! recursiveEquals(previousState, state)) {
      let subs = this._subscribers.slice();
      for (let i = 0, l = subs.length; i < l; i += 1) {
        subs[i](state);
      }
      this._lastState.set(state, cacheValidityPeriod);
    } else {
      this._lastState.refresh(cacheValidityPeriod);
    }

    return state;
  }

  findStateOnce() {
    if (this._lastState.isValid) {
      return Promise.resolve(this._lastState.get());
    } else {
      return this.forceRefresh();
    }
  }

  getCurrentState() {
    throw new Error('Finder#getCurrentState must be implemented');
  }
}
exports.Finder = Finder;
