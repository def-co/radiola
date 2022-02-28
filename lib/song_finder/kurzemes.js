"use strict";

const { Finder } = require('./_generic'),
      fetch = require('../http/fetch');

const KURZEMES_URL = 'http://kurzemesradio.lv/NowOnAir.xml';

class KurzemesFinder extends Finder {
  getCurrentState() {
    return fetch(KURZEMES_URL)
      .then((resp) => resp.text())
      .then((data) => {
        const title = /<Song title="([^"]+)">/.exec(data);
        const artist = /<Artist name="([^"]+)"/.exec(data);
        if (artist && title) {
          return { song: { artist: artist[1], title: title[1] } };
        }
        return { };
      });
  }
}

exports.ViegliFinder = ViegliFinder;
