'use strict';

const request = require('request-promise-native'),
      L = require('modulog').bound('discover.starfm'),
      _ = require('lodash')

const GenericDelegate = require('./generic')

const STARFM_PROGRAM_URL = 'http://skaties.lv/api/1/starfm/program/',
      STARFM_SONG_URL = 'http://skaties.lv/api/1/starfm/song/'

class StarFM extends GenericDelegate {
  constructor() {
    super()

    this.msMinimum = 15000
    this.msDelta = 45000

    this.errorWarningThreshold = 0
    this.errorInterruptThreshold = 5

    this.name = 'Star FM'
    this.L = L
  }

  refreshState() {
    return Promise.all([
      request({ url: STARFM_SONG_URL, json: true }),
      request({ url: STARFM_PROGRAM_URL, json: true }),
    ]).then(([ songData, programData ]) => {
      let { artist, song } = songData,
          { djs, title } = programData
      return {
        program: title ? `${title}${ djs ? ' (' + djs + ')' : '' }` : null,
        song: { title: song, artist }
      }
    })
  }
}
StarFM.prototype.canDiscover = ['song', 'program']

module.exports = StarFM
