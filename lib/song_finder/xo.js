"use strict";

const { Finder } = require('./_generic'),
      fetch = require('../http/fetch');

const XO_API_URL = 'https://live.xo.fm/json.xsl?callback=parseMusic';
const MARKER = String.fromCodePoint(0xFEFF);

class XoFinder extends Finder {
  getCurrentState() {
    return fetch(XO_API_URL)
      .then((resp) => resp.text())
      .then((text) => {
        let j = /^parseMusic\((\{.*\})\);$/.exec(text);
        if (!j) {
          return null;
        }
        let data = JSON.parse(j[1]);
        this.time = performance.now() + data.time * 1000;
        let { title } = data['/xofm256'];
        if (title.indexOf(' - ') === -1) {
          return { song: { title } };
        }
        let [ artist, song ] = title.split(' - ');
        return {
          song: {
            artist: artist.replaceAll(MARKER, ''),
            title: song.replaceAll(MARKER, ''),
          },
        };
      });
  }
}

exports.XoFinder = XoFinder;
