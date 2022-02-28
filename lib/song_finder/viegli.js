"use strict";

const { Finder } = require('./_generic'),
      fetch = require('../http/fetch');

const VIEGLI_API_URL = 'https://public.radio.co/api/v2/sdefc884be/track/current';

class ViegliFinder extends Finder {
  getCurrentState() {
    return fetch(VIEGLI_API_URL)
      .then((resp) => resp.json())
      .then((data) => {
        const song = data.data.title;
        let [ artist, title ] = song.split(' - ');
        return { song: { artist, title } };
      });
  }
}

exports.ViegliFinder = ViegliFinder;
