'use strict';

const EventEmitter = require('events')

const request = require('request-promise-native'),
      _ = require('lodash'),
      L = require('modulog').bound('discover.pieci')

const PATH = 'shared/cache/current_all.json',
      URLS = {
        pieci_koncerti: `https://koncerti.pieci.lv/${PATH}`,
        pieci_atklajumi: `https://atklajumi.pieci.lv/${PATH}`,
        pieci_latviesi: `https://latviesi.pieci.lv/${PATH}`,
        pieci_hiti: `https://hiti.pieci.lv/${PATH}`,
        pieci: `https://fm.pieci.lv/${PATH}`,
        pieci_ziemassvetki: `https://ziemassvetki.pieci.lv/${PATH}`,
      }

const STREAM_NAME_MAP = {
  1: 'pieci_koncerti',
  5: 'pieci_atklajumi',
  7: 'pieci_latviesi',
  // 11: 'pieci_riti', // does not provide NP info
  17: 'pieci_hiti',
  19: 'pieci',

  // contemporary stations below
  9: 'pieci_ziemassvetki',
  // 26: 'pieci_100', // currently off air? or so it seems
}

class Pieci extends EventEmitter {
  constructor() {
    super()

    this._nextTimeout = null
    this._listeners = {
      pieci_koncerti: 0,
      pieci_atklajumi: 0,
      pieci_latviesi: 0,
      pieci_hiti: 0,
      pieci: 0,
      pieci_ziemassvetki: 0,
    }

    this._lastSongs = {
      pieci_koncerti: null,
      pieci_atklajumi: null,
      pieci_latviesi: null,
      pieci_hiti: null,
      pieci: null,
      pieci_ziemassvetki: null,
    }

    this._cacheStillValid = false
    this._cacheInvalidationTimeout = null
  }

  get listeners() {
    return _.reduce(this._listeners, (a, v) => a + v, 0)
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

    if (this._lastSongs[station] !== null) {
      publishUpdate('song', this._lastSongs[station])
    }

    let _handleSong = null
    if (_.includes(events, 'song')) {
      _handleSong = publishUpdate.bind(this, 'song')
      this.addListener(`change.song.${station}`, _handleSong)
    }

    let _handleErrorCountExceeded = () => {
      publishUpdate('server_error', null)
      setTimeout(() => stream.emit('close'))
    }
    this.addListener('errorCountExceeded', _handleErrorCountExceeded)

    let s = setInterval(() => {
      // prevents Hapi from closing the connection
      publishUpdate('keepalive', null)
    }, 60000)

    stream.on('close', () => {
      clearInterval(s)
      if (_handleSong !== null) {
        this.removeListener(`change.song.${station}`, _handleSong)
      }

      this.removeListener('errorCountExceeded', _handleErrorCountExceeded)

      this._listeners[station] -= 1
      if (this.listeners === 0 && this._nextTimeout !== null) {
        clearTimeout(this.nextTimeout)
        this.nextTimeout = null
      }
    })

    this._listeners[station] += 1
    if (this.listeners > 0 && this._nextTimeout === null) {
      this.startInterval()
    }
  }

  computeNextPollTimeout(errorCount) {
    const msMinimum = 9000, msDelta = 6000
    const errorInterruptThreshold = 7, errorWarningThreshold = 2

    let ms = msMinimum + Math.round(Math.random() * msDelta)
    if (errorCount > errorInterruptThreshold) {
      // L.error('Too many errors encountered while trying to fetch Pieci NP; ' +
      // 'aborting!')
      return null
    } else if (errorCount > errorWarningThreshold) {
      let addMs = 100 * Math.pow(2, errorCount - 3)
      L.warning('Many errors encountered while fetching Pieci NP; ' +
        'performing exponential backoff (currently at %d ms)', addMs)
      return ms + addMs
    } else {
      return ms
    }
  }

  startInterval() {
    let errorCount = 0
    const performPoll = () => {
      let ms = this.computeNextPollTimeout(errorCount)
      if (ms) {
        // L.debug('Scheduling next poll in %f.02 seconds', ms / 1000)
        this.nextTimeout = setTimeout(performPoll, ms)
      } else {
        L.error('Error threshold exceeded! Aborting polling loop.')
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
        L.warning('An error happened during fetching of Pieci NP: %s', e)
        L.debug('', e)
        errorCount++
      })
    }
    performPoll()
  }

  refreshState() {
    let url
    {
      let listenedStations = [ ]
      _.forEach(this._listeners, (listenerCount, name) => {
        if (listenerCount > 0) {
          listenedStations.push(name)
        }
      })
      if (listenedStations.length === 0) {
        listenedStations = Object.keys(this._listeners)
      }
      let station = _.shuffle(listenedStations).pop()
      url = URLS[station]
    }

    return request({
      url: url,
      json: true,
    })
    .then((state) => this.processState(state))
  }

  processState(streams) {
    clearTimeout(this._cacheInvalidationTimeout)
    this._cacheInvalidationTimeout = setTimeout(() => {
      this._cacheStillValid = false
      this._cacheInvalidationTimeout = null
    }, 8750)
    this._cacheStillValid = true

    for (let stream of streams) {
      try {
        let stationName = STREAM_NAME_MAP[stream.id]
        let nowPlaying = stream.playlist[0]
        // if (typeof nowPlaying === 'undefined') { continue }
        let song
        {
          let { artist, title } = nowPlaying
          song = { artist, title }
        }

        if (_.isEqual(song, this._lastSongs[stationName])) {
          continue
        } else {
          this._lastSongs[stationName] = song
          this.emit(`change.song.${stationName}`, song)
        }
      } catch (e) {
        // Pieci often responds with malformed entries, undefined playlists and
        // so on, therefore we just fail gracefully when there's something
        // really wrong
        if (e instanceof TypeError) {
          continue
        } else {
          throw e
        }
      }
    }

    return streams
  }

  discoverOnce(station) {
    if (this._cacheStillValid) {
      return Promise.resolve({ program: null, song: this._lastSongs[station] })
    } else {
      return this.refreshState()
      .then(() => ({ program: null, song: this._lastSongs[station] }))
    }
  }
}
Pieci.prototype.canDiscover = ['song']

module.exports = Pieci
