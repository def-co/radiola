"use strict";

const { Finder } = require('./_generic'),
      fetch = require('../http/fetch');

const STARFM_SONG_URL = 'https://skaties.lv/api/1/starfm/song/',
      STARFM_PROGRAM_URL = 'https://skaties.lv/api/1/starfm/program/';

class StarFMFinder extends Finder {
  constructor() {
    super();

    this.refreshIntervalBase = 15000;
    this.refreshIntervalJitter = 45000;
  }

  getCurrentState() {
    return Promise.all([
      fetch(STARFM_SONG_URL).then(resp => resp.json()),
      fetch(STARFM_PROGRAM_URL).then(resp => resp.json()),
    ]).then(([ { artist, song }, program ]) => {
      let { djs, title } = program;

      djs = djs ? ` (${djs})` : '';

      let data = {
        song: { artist, title: song },
      };

      if (title) {
        data.program = `${title}${djs}`;
      }

      return data;
    });
  }
}

exports.StarFMFinder = StarFMFinder;
