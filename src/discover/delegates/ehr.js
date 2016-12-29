'use strict';

const EventEmitter = require('events')

const request = require('request-promise-native'),
      _ = require('lodash'),
      L = require('modulog').bound('discover.ehr')

const GenericDelegate = require('./generic')

const EHR_URL = 'https://www.ehrmedijugrupa.lv/api/channel/now_playing?stream_id=1'

class EHR extends GenericDelegate {
  constructor() {
    super()

    this.msMinimum = 4000
    this.msDelta = 4000

    this.errorWarningThreshold = 0
    this.errorInterruptThreshold = 3

    this.name = 'EHR'
    this.L = L
  }

  refreshState() {
    return request({
      url: EHR_URL,
      json: true,
    }).then((data) => {
      if (data.status !== 'ok') {
        let e = new Error(`Status wasn't ok: ${data}`)
        e.body = data
        throw e
      } else {
        let { song_artist, song_name } = data.data.pop()
        return {
          program: null,
          song: { artist: song_artist, title: song_name },
        }
      }
    }).then((song) => this.processState(song))
  }
}
EHR.prototype.canDiscover = ['song']

module.exports = EHR
