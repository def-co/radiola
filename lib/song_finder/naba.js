"use strict";

const { Finder } = require('./_generic'),
      fetch = require('../http/fetch'),
      { decodeHTMLEntities } = require('../text_utils');

const NABA_SONG_URL = 'https://www.naba.lv/naba_skan.php?act=skan',
      NABA_PROGRAM_URL = 'https://www.naba.lv/naba_skan.php?act=prog';

const NABA_SONG_REGEX = /<a href="[.\/:abhilnpstvwy]+">([^<]+)<\/a>/;

class NabaFinder extends Finder {
  getCurrentState() {
    return Promise.all([
      fetch(NABA_SONG_URL).then((resp) => resp.text()),
      fetch(NABA_PROGRAM_URL).then((resp) => resp.text()),
    ]).then(([ song, program ]) => {
      if (program === 'Mūzika') {
        program = null;
      }

      let songContent = NABA_SONG_REGEX.exec(song)[1];
      songContent = decodeHTMLEntities(songContent);
      let [ artist, title ] = songContent.split(
        String.fromCodePoint(160) + '-' + String.fromCodePoint(160))
        .map((str) => str.trim());

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
