'use strict';

const EventEmitter = require('events')

const _ = require('lodash'),
      Modulog = require('modulog')

class GenericDelegate extends EventEmitter {
  constructor() {
    super()

    this.name = 'GenericDelegate'

    this.nextTimeout = null
    this.listeners = 0
    this.lastSong = null

    this.cacheInvalidationTimeout = null
    this.cacheStillValid = false

    this.msMinimum = 9000
    this.msDelta = 6000

    this.errorWarningThreshold = 2
    this.errorInterruptThreshold = 10

    this.L = Modulog.bound('discover.generic_delegate')
  }

  attachStream(stream, station) {
    this.addToInterval()

    const publishUpdate = (data) => {
      stream.write([
        'event: song',
        `data: ${JSON.stringify(data)}`,
        '',
        '',
      ].join('\n'))
    }

    if (this.lastSong !== null) {
      publishUpdate(this.lastSong)
    }

    this.addListener('song', publishUpdate)

    let s = setInterval(() => {
      // prevents Hapi from closing the connection
      stream.write([
        'event: keepalive',
        'data: null',
        '',
        '',
      ].join('\n'))
    }, 60000)

    stream.on('close', () => {
      clearInterval(s)
      this.removeListener('song', publishUpdate)
      this.removeFromInterval()
    })
  }

  addToInterval() {
    this.listeners++
    if (this.nextTimeout === null) {
      this.startInterval()
    }
  }

  removeFromInterval() {
    if (--this.listeners === 0) {
      clearTimeout(this.nextTimeout)
      this.nextTimeout = null
    }
  }

  startInterval() {
    const L = this.L

    let errorCount = 0
    const performPoll = () => {
      let ms = this.msMinimum + Math.round(Math.random() * this.msDelta)
      if (errorCount > this.errorInterruptThreshold) {
        L.error('Too many errors encountered while fetching %s NP; aborting!',
          this.name)
        this.nextTimeout = null
        this.emit('errorCountExceeded')
        return
      } else if (errorCount > this.errorWarningThreshold) {
        let addSeconds = Math.pow(2, errorCount - this.errorWarningThreshold)
        L.warning('Many errors encountered when fetch %s NP; ' +
          'performing exponential backoff (currently at %d seconds)',
            this.name, addSeconds)
        ms += 1000 * addSeconds
      }
      this.nextTimeout = setTimeout(performPoll, ms)

      if (this.cacheStillValid) { return }

      this.fetchCurrentlyPlaying()
      .catch((e) => {
        L.warning('An error encountered during fetching %s NP:', this.name, e)
        errorCount++
      })
    }

    performPoll()
  }

  fetchCurrentlyPlaying() {
    throw new Error(
      'GenericDelegate#fetchCurrentlyPlaying should be overridden')
  }

  optionallyDispatchUpdate(song) {
    clearTimeout(this.cacheInvalidationTimeout)
    this.cacheInvalidationTimeout = setTimeout(() => {
      this.cacheStillValid = false
      this.cacheInvalidationTimeout = null
    }, this.msMinimum - 250)
    this.cacheStillValid = true

    if (!_.isEqual(song, this.lastSong)) {
      this.lastSong = song
      this.emit('song', song)
    }

    return song
  }

  findSongOnce() {
    if (this.cacheStillValid) {
      return Promise.resolve(this.lastSong)
    } else {
      return this.fetchCurrentlyPlaying()
      .then(() => this.lastSong)
    }
  }
}

module.exports = GenericDelegate
