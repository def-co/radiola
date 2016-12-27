'use strict';

const EventEmitter = require('events')

const request = require('request-promise-native'),
      _ = require('lodash'),
      L = require('modulog').bound('discover.swh')

const GenericDelegate = require('./generic')

const SWH_URL = 'http://195.13.237.142:8080/swh_online.json',
      SWH_GOLD_URL = 'http://195.13.237.142:8080/gold_online.json',
      SWH_ROCK_URL = 'http://195.13.237.142:8080/rock_online.txt'

class SWH extends GenericDelegate {
  constructor() {
    super()
    this.name = 'SWH'
    this.url = SWH_URL
    this.L = L
  }

  fetchCurrentlyPlaying() {
    return request({
      url: this.url,
      json: true,
    }).then((streams) => {
      let { artist, title } = streams[0]
      return { artist, title }
    }).then((song) => this.optionallyDispatchUpdate(song))
  }
}

class SWHGold extends SWH {
  constructor() {
    super()
    this.name = 'SWH Gold'
    this.url = SWH_GOLD_URL
  }
}

class SWHRock extends SWH {
  constructor() {
    super()
    this.name = 'SWH Rock'
    this.url = SWH_ROCK_URL
  }

  fetchCurrentlyPlaying() {
    return request({
      url: this.url,
    }).then((text) => {
      let [artist, ...title] = text.split('-')
      return { artist: artist.trim(), title: title.join('-').trim() }
    }).then((song) => this.optionallyDispatchUpdate(song))
  }
}


module.exports = { SWH, SWHGold, SWHRock, }
