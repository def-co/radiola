'use strict';

const EventEmitter = require('events')

const _ = require('lodash'),
      request = require('request-promise-native'),
      Modulog = require('modulog')

const GenericDelegate = require('./generic')

const LR_URL =
  'http://www.latvijasradio.lsm.lv/lv/tiesraide/?rt=site&ac=liveplayerInfo'

class LRGeneric extends GenericDelegate {
  constructor() {
    super()

    this.name = 'LR.generic'
    this._channelIndex = null
    this.canDiscover = ['program']

    this.L = Modulog.bound('delegates.lr_generic')
  }

  refreshState() {
    return request({
      url: LR_URL + `&channel=${this._channelIndex}&subchannel=0`,
      json: true,
    })
    .then((data) => {
      let { title: program, artist, song: title } = data['' + this._channelIndex]
      let song = { artist, title }
      if (program.trim() === '') { program = null }
      if (artist.trim() === '' || song.trim() === '') { song = null }
      return { program, song }
    })
    .then((state) => this.processState(state))
  }
}

class LR1 extends LRGeneric {
  constructor() {
    super()
    this.name = 'LR1'
    this.L = Modulog.bound('delegates.lr1')
    this._channelIndex = 1
  }
}

class LR2 extends LRGeneric {
  constructor() {
    super()
    this.name = 'LR2'
    this.L = Modulog.bound('delegates.lr2')
    this._channelIndex = 2
  }
}

class LR3 extends LRGeneric {
  constructor() {
    super()
    this.name = 'LR3'
    this.L = Modulog.bound('delegates.lr3')
    this._channelIndex = 3
  }
}

class LR4 extends LRGeneric {
  constructor() {
    super()
    this.name = 'LR4'
    this.L = Modulog.bound('delegates.lr4')
    this._channelIndex = 4
  }
}

class LR6 extends LRGeneric {
  constructor() {
    super()
    this.name = 'LR6'
    this.L = Modulog.bound('delegates.lr6')
    this._channelIndex = 6
  }
}

module.exports = { LR1, LR2, LR3, LR4, LR6 }
