'use strict';

const EventEmitter = require('events')

const _ = require('lodash'),
      Modulog = require('modulog')

class GenericDelegate extends EventEmitter {
  constructor() {
    super()

    this.name = 'GenericDelegate'

    this._nextTimeout = null
    this._listeners = 0
    this._lastState = { program: null, song: null }

    this._cacheInvalidationTimeout = null
    this._cacheStillValid = false

    this.msMinimum = 9000
    this.msDelta = 6000

    this.errorWarningThreshold = 2
    this.errorInterruptThreshold = 10

    this.L = Modulog.bound('discover.generic_delegate')
  }

  get listeners() {
    return this._listeners
  }
  set listeners(v) {
    this._listeners = v
    if (this._listeners > 0 && this._nextTimeout === null) {
      this.startInterval()
    } else if (this._listeners === 0 && this._nextTimeout !== null) {
      clearTimeout(this.nextTimeout)
      this.nextTimeout = null
    }
    return v
  }

  subscribeStream(stream, station, events = [ ]) {
    const publishUpdate = (event, data) => {
      stream.write([
        `event: ${event}`,
        `data: ${JSON.stringify(data)}`,
        '',
        '',
      ].join('\n'))
    }

    let _handleProgram = null, _handleSong = null

    if (_.includes(events, 'program') &&
        _.includes(this.canDiscover, 'program')) {
      if (this._lastState.program !== null) {
        publishUpdate('program', this._lastState.program)
      }
      _handleProgram = publishUpdate.bind(this, 'program')
      this.addListener('change.program', _handleProgram)
    }

    if (_.includes(events, 'song') && _.includes(this.canDiscover, 'song')) {
      if (this._lastState.song !== null) {
        publishUpdate('song', this._lastState.song)
      }
      _handleSong = publishUpdate.bind(this, 'song')
      this.addListener('change.song', _handleSong)
    }

    this.emit('_meta.stream.add', stream, station, events)

    let s = setInterval(() => {
      // prevents Hapi from closing the connection
      publishUpdate('keepalive', null)
    }, 60000)

    stream.on('close', () => {
      clearInterval(s)
      if (_handleProgram !== null) {
        this.removeListener('change.program', _handleProgram)
      }
      if (_handleSong !== null) {
        this.removeListener('change.song', _handleSong)
      }
      this.emit('_meta.stream.close', stream, station, events)
      this.listeners -= 1
    })

    this.listeners += 1
  }

  computeNextPollTimeout(errorCount) {
    let ms = this.msMinimum + Math.round(Math.random() * this.msDelta)
    if (errorCount > this.errorInterruptThreshold) {
      // throw new Error('Interrupt')
      return null
    } else if (errorCount > this.errorWarningThreshold) {
      let addSeconds = Math.pow(2, errorCount - this.errorWarningThreshold)
      this.L.warning('Many errors encountered when fetching %s NP; ' +
        'performing exponential backoff (currently at %d seconds)',
          this.name, addSeconds)
      ms += 1000 * addSeconds
    }
    return ms
  }

  startInterval() {
    const L = this.L

    let errorCount = 0
    const performPoll = () => {
      let ms = this.computeNextPollTimeout(errorCount)
      if (ms) {
        this.nextTimeout = setTimeout(performPoll, ms)
      } else {
        this.L.error('Error threshold exceeded for fetching %s NP; aborting!',
          this.name)
        this.nextTimeout = null
        this.emit('errorCountExceeded')
        return
      }

      if (this._cacheStillValid) { return }

      this.refreshState()
      .then((s) => {
        errorCount = 0
        return s
      })
      .catch((e) => {
        L.warning('An error encountered during fetching %s NP: %s',
          this.name, e)
        L.debug('', e)
        errorCount++
      })
    }

    performPoll()
  }

  refreshState() {
    throw new Error('GenericDelegate#refreshState should be overridden')
  }

  processState(state) {
    clearTimeout(this._cacheInvalidationTimeout)
    this._cacheInvalidationTimeout = setTimeout(() => {
      this._cacheStillValid = false
      this._cacheInvalidationTimeout = null
    }, this.msMinimum - 250)
    this._cacheStillValid = true

    if (!_.isEqual(state, this._lastState)) {
      if (state.program !== this._lastState.program) {
        this.emit('change.program', state.program, this._lastState.program)
      }
      if (!_.isEqual(state.song, this._lastState.song)) {
        this.emit('change.song', state.song, this._lastState.song)
      }
      this.emit('change', state, this._lastState)
      this._lastState = state
    }

    return state
  }


  discoverOnce() {
    if (this._cacheStillValid) {
      return Promise.resolve(this._lastState)
    } else {
      return this.refreshState()
    }
  }
}

module.exports = GenericDelegate
