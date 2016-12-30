'use strict';

const request = require('request-promise-native'),
      L = require('modulog').bound('discover.naba'),
      cheerio = require('cheerio'),
      _ = require('lodash')

const GenericDelegate = require('./generic')

const NABA_NOWPLAYING_URL = 'http://www.naba.lv/naba_skan.php?act=skan',
      NABA_PROG_URL = 'http://www.naba.lv/naba_skan.php?act=prog'

class Naba extends GenericDelegate {
  constructor() {
    super()

    this.errorWarningThreshold = 1
    this.errorInterruptThreshold = 5

    this._programListeners = 0
    this._songListeners = 0

    // this sort of interferes with the builtin caching of the generic delegate
    // perhaps a candidate for rewrite TODO
    this._programCacheStillValid = false
    this._programCacheTimeout = null
    this._songCacheStillValid = false
    this._songCacheTimeout = null

    this.name = 'LR6/NABA'
    this.L = L

    this.on('_meta.stream.add', (stream, station, events) => {
      if (_.includes(events, 'program')) {
        this._programListeners += 1
      }
      if (_.includes(events, 'song')) {
        this._songListeners += 1
      }
    })
    this.on('_meta.stream.close', (stream, station, events) => {
      if (_.includes(events, 'program')) {
        this._programListeners -= 1
      }
      if (_.includes(events, 'song')) {
        this._songListeners -= 1
      }
    })
  }

  computeNextPollTimeout(errorCount) {
    let ms = 15000
    if (errorCount > this.errorInterruptThreshold) {
      return null
    } else if (errorCount > this.errorWarningThreshold) {
      let s = 15 * Math.pow(2, errorCount - this.errorWarningThreshold)
      this.L.warning('Many errors encountered when fetching %s NP; ' +
        'performing backoff (currently at +%d seconds)',
          this.name, s)
      ms += s * 1000
    }
    return ms
  }

  refreshState(_force) {
    // Nero - Promises
    let promises = [ ]

    if (this._programListeners > 0 || _.includes(_force, 'program')) {
      if (this._programCacheStillValid) {
        promises.push(Promise.resolve(this._lastState.program))
      } else {
        promises.push(
          request({
            url: NABA_PROG_URL,
          })
          .then((body) => {
            this._programCacheTimeout = setTimeout(() => {
              this._programCacheStillValid = false
              this._programCacheTimeout = null
            }, 180 * 1000)
            this._programCacheStillValid = true

            let $ = cheerio.load(body)
            let s = $('a').eq(0).text().trim()
            if (s === '') {
              s = body.trim()
            }
            if (s === 'Mūzika') {
              s = null
            }
            return s
          })
          // .catch((e) => {
          //   L.warning('', e)
          //   return null
          // })
        )
      }
    } else {
      promises.push(Promise.resolve(null))
    }

    if (this._songListeners > 0 || _.includes(_force, 'song')) {
      if (this._songCacheStillValid) {
        promises.push(Promise.resolve(this._lastState.song))
      } else {
        promises.push(
          request({
            url: NABA_NOWPLAYING_URL,
          })
          .then((body) => {
            this._songCacheTimeout = setTimeout(() => {
              this._songCacheStillValid = false
              this._songCacheTimeout = null
            }, 15 * 1000)
            this._songCacheStillValid = true

            let $ = cheerio.load(body)
            let s = $('a').eq(0).text().split('-').map(s => s.trim())
            if (s.length < 2) return null
            return { artist: s[0], title: s.slice(1).join('-') }
          })
          // .catch((e) => {
          //   L.warning('', e)
          //   return null
          // })
        )
      }
    } else {
      promises.push(Promise.resolve(null))
    }

    return Promise.all(promises)
    .then(([program, song]) => ({ program, song }))
    .then((state) => {
      if (state.program && state.song) {
        let s = state.song.artist + '-'+ state.song.title
        if (state.program === s) {
          // ugh I hate when this happens
          state.song = null
        }
      }
      return this.processState(state)
    })
  }

  discoverOnce() {
    let program = null, song = null

    if (this._programCacheStillValid && this._lastState.program !== null) {
      program = Promise.resolve(this._lastState.program)
    }
    if (this._songCacheStillValid && this._lastState.song !== null) {
      song = Promise.resolve(this._lastState.song)
    }

    if (program !== null && song !== null) {
      return Promise.resolve({ program, song })
    }

    let _force = [ ]
    if (program === null) { _force.push('program') }
    if (song === null) { _force.push('song') }

    return this.refreshState(_force)
  }
}
Naba.prototype.canDiscover = ['song', 'program']

module.exports = Naba
