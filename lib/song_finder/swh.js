"use strict";

const { Finder } = require('./_generic'),
      fetch = require('../http/fetch'),
      { decodeHTMLEntities } = require('../text_utils');

const SWH_URL = 'https://radioswhgold.lv:8182/swh_online.json',
      SWH_GOLD_URL = 'https://radioswhgold.lv:8182/gold_online.json',
      SWH_ROCK_URL = 'https://radioswhgold.lv:8182/rock_online.json';

class SWHFinder extends Finder {
  constructor() {
    super();
    this.url = SWH_URL;
  }

  getCurrentState() {
    return fetch(this.url)
      .then((resp) => resp.json())
      .then((data) => {
        data = data[0];

        let state = {
          song: {
            artist: decodeHTMLEntities(data.artist),
            title: decodeHTMLEntities(data.title),
          },
        };

        if ('sobrid_etera_title' in data &&
            data.sobrid_etera_title !== null) {
          state.program = decodeHTMLEntities(data.sobrid_etera_title);
        }

        return state;
      });
  }
}

class SWHGoldFinder extends SWHFinder {
  constructor() {
    super();
    this.url = SWH_GOLD_URL;
  }
}

class SWHRockFinder extends SWHFinder {
  constructor() {
    super();
    this.url = SWH_ROCK_URL;
  }
}

exports.SWHFinder = SWHFinder;
exports.SWHGoldFinder = SWHGoldFinder;
exports.SWHRockFinder = SWHRockFinder;
