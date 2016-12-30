'use strict';

const EventEmitter = require('events')

const request = require('request-promise-native'),
      _ = require('lodash'),
      cheerio = require('cheerio'),
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

    this.errorWarningThreshold = 0
    this.errorInterruptThreshold = 5
  }

  refreshState() {
    return request({
      url: this.url,
      json: true,
    })
    .then((streams) => {
      let { artist, title, sobrid_etera_title } = streams[0]
      let $ = cheerio.load('<div></div>'), p = $('<p>')
      if (artist !== null) { artist = p.html(artist).text() }
      if (title !== null) { title = p.html(title).text() }
      if (sobrid_etera_title) {
        sobrid_etera_title = p.html(sobrid_etera_title).text()
      }
      // sobrid_etera_title might be null which indicates that there is no
      // ongoing program
      return {
        program: sobrid_etera_title,
        song: { artist, title },
      }
    })
    .then((state) => this.processState(state))
  }
}
SWH.prototype.canDiscover = ['song', 'program']

class SWHGold extends SWH {
  constructor() {
    super()

    this.name = 'SWH Gold'
    this.url = SWH_GOLD_URL
  }
}
// program seems to be null all the time?
SWHGold.prototype.canDiscover = ['song']

class SWHRock extends SWH {
  constructor() {
    super()

    this.name = 'SWH Rock'
    this.url = SWH_ROCK_URL
  }

  refreshState() {
    return request({
      url: this.url,
    })
    .then((text) => {
      let $ = cheerio.load('<div></div>'),
          s = $('<p>').html(text).text()
      let [artist, ...title] = s.split('-')
      return {
        program: null,
        song: { artist: artist.trim(), title: title.join('-').trim(), },
      }
    })
    .then((state) => this.processState(state))
  }
}
SWHGold.prototype.canDiscover = ['song']

module.exports = { SWH, SWHGold, SWHRock, }
