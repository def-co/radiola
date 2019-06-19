"use strict";

const { Finder } = require('./_generic'),
      fetch = require('../http/fetch');

const LR_URL_BASE =
  'https://latvijasradio.lsm.lv/lv/tiesraide/?rt=site&ac=liveplayerInfo';

class LRGenericFinder extends Finder {
  constructor() {
    super();
    this.channelIndex = null;
  }

  getCurrentState() {
    return fetch(LR_URL_BASE + `&channel=${this.channelIndex}&subchannel=0`)
      .then((resp) => resp.json())
      .then((data) => {
        data = data[this.channelIndex];
        let artist = data.artist || null,
            title = data.song || null,
            program = data.title || null;

        let state = { };

        if (artist !== null && title !== null) {
          state.song = { artist, title };
        }
        if (program !== null) {
          state.program = program;
        }

        return state;
      });
  }
}

class LR1Finder extends LRGenericFinder {
  constructor() {
    super();
    this.channelIndex = 1;
  }
}

class LR2Finder extends LRGenericFinder {
  constructor() {
    super();
    this.channelIndex = 2;
  }
}

class LR3Finder extends LRGenericFinder {
  constructor() {
    super();
    this.channelIndex = 3;
  }
}

class LR4Finder extends LRGenericFinder {
  constructor() {
    super();
    this.channelIndex = 4;
  }
}

exports.LR1Finder = LR1Finder;
exports.LR2Finder = LR2Finder;
exports.LR3Finder = LR3Finder;
exports.LR4Finder = LR4Finder;
