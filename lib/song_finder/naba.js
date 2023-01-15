"use strict";

const { Finder } = require('./_generic'),
      fetch = require('../http/fetch');

const NABA_URL = 'https://www.lu.lv/api/?r=naba-live/search/';

class NabaFinder extends Finder {
  getCurrentState() {
    return fetch(NABA_URL).then((resp) => resp.json()).then((resp) => {
      let program = resp.programme;
      if (program === 'Mūzika') {
        program = null;
      }

      let songContent = resp.songString;
      let [ artist, title ] = songContent.split(' - ').map((str) => str.trim());

      artist.replace(/\s+/g, ' ');
      title.replace(/\s+/g, ' ');

      let state = { };
      if (artist !== '' && title !== '') {
        state.song = { artist, title };
      }
      if (program !== null) {
        state.program = program;
      }
      return state;
    });
  }
}

exports.NabaFinder = NabaFinder;
