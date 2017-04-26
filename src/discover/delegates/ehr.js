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

class EHR extends GenericEHR {
  constructor() {
    super()
    this.streamId = 1
  }
}
EHR.prototype.canDiscover = ['song']

class EHRSuperhits extends GenericEHR {
  constructor() {
    super()
    this.streamId = 11
  }
}
EHRSuperhits.prototype.canDiscover = ['song']

class EHRKH extends GenericEHR {
  constructor() {
    super()
    this.streamId = 3
  }
}
EHRKH.prototype.canDiscover = ['song']

class EHRFresh extends GenericEHR {
  constructor() {
    super()
    this.streamId = 13
  }
}
EHRFresh.prototype.canDiscover = ['song']

class EHRLatvHiti extends GenericEHR {
  constructor() {
    super()
    this.streamId = 10
  }
}
EHRLatvHiti.prototype.canDiscover = ['song']

class EHRTop40 extends GenericEHR {
  constructor() {
    super()
    this.streamId = 12
  }
}
EHRTop40.prototype.canDiscover = ['song']

class EHRLove extends GenericEHR {
  constructor() {
    super()
    this.streamId = 26
  }
}
EHRLove.prototype.canDiscover = ['song']

class EHRDarbam extends GenericEHR {
  constructor() {
    super()
    this.streamId = 25
  }
}
EHRDarbam.prototype.canDiscover = ['song']

class EHRDance extends GenericEHR {
  constructor() {
    super()
    this.streamId = 16
  }
}
EHRDance.prototype.canDiscover = ['song']

class EHRAcoustic extends GenericEHR {
  constructor() {
    super()
    this.streamId = 18
  }
}
EHRAcoustic.prototype.canDiscover = ['song']

module.exports = { EHR, EHRSuperhits, EHRKH, EHRFresh, EHRLatvHiti, EHRTop40,
  EHRLove, EHRDarbam, EHRDance, EHRAcoustic }
