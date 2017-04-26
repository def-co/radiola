'use strict';

const EventEmitter = require('events')

const request = require('request-promise-native'),
      _ = require('lodash'),
      L = require('modulog').bound('discover.ehr')

const GenericDelegate = require('./generic')

const EHR_URL = 'https://www.ehrmedijugrupa.lv/api/channel/now_playing?stream_id='

class GenericEHR extends GenericDelegate {
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
      url: EHR_URL + this.streamId,
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
GenericEHR.prototype.canDiscover = ['song']

class EHR extends GenericEHR {
  constructor() {
    super()
    this.streamId = 1
  }
}
class EHRSuperhits extends GenericEHR {
  constructor() {
    super()
    this.streamId = 11
  }
}
class EHRKH extends GenericEHR {
  constructor() {
    super()
    this.streamId = 3
  }
}
class EHRFresh extends GenericEHR {
  constructor() {
    super()
    this.streamId = 13
  }
}
class EHRLatvHiti extends GenericEHR {
  constructor() {
    super()
    this.streamId = 10
  }
}
class EHRTop40 extends GenericEHR {
  constructor() {
    super()
    this.streamId = 12
  }
}
class EHRLove extends GenericEHR {
  constructor() {
    super()
    this.streamId = 26
  }
}
class EHRDarbam extends GenericEHR {
  constructor() {
    super()
    this.streamId = 25
  }
}
class EHRDance extends GenericEHR {
  constructor() {
    super()
    this.streamId = 16
  }
}
class EHRAcoustic extends GenericEHR {
  constructor() {
    super()
    this.streamId = 18
  }
}

module.exports = { EHR, EHRSuperhits, EHRKH, EHRFresh, EHRLatvHiti, EHRTop40,
  EHRLove, EHRDarbam, EHRDance, EHRAcoustic }
