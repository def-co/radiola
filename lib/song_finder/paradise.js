"use strict";

const { Finder } = require('./_generic'),
      fetch = require('../http/fetch');

const PARADISE_API_URL = 'https://api.radioparadise.com/api/now_playing?chan=0';

class ParadiseFinder extends Finder {
  constructor() {
    super();
    this.time = null;
  }

  _computeNextTimeout(errorCount) {
    if (errorCount !== 0 || this.time === null) {
      return super._computeNext(errorCount);
    }
    return this.time - performance.now() + 1000;
  }

  getCurrentState() {
    return fetch(PARADISE_API_URL)
      .then((resp) => resp.json())
      .then((data) => {
        this.time = performance.now() + data.time * 1000;
        let { artist, title } = data;
        return { song: { artist, title } };
      });
  }
}

exports.ParadiseFinder = ParadiseFinder;
