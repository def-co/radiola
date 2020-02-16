"use strict";

const { Finder } = require('./_generic'),
      fetch = require('../http/fetch');

const STALICA_URL = 'https://radiostalica.by/player.php';

class StalicaFinder extends Finder {
  getCurrentState() {
    return fetch(STALICA_URL)
      .then((resp) => resp.text())
      .then((song) => {
        let [ artist, title ] = song.split(' - ');
        if (artist === '') {
          artist = title;
          title = undefined;
        }
        if (artist === '') {
          return { };
        }
        if (title === undefined) {
          return { program: song };
        }
        return { song: { artist, title } };
      });
  }
}

exports.StalicaFinder = StalicaFinder;
