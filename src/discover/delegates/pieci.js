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

    this.nextTimeout = null
    this.listeners = {
      pieci_koncerti: 0,
      pieci_atklajumi: 0,
      pieci_latviesi: 0,
      pieci_hiti: 0,
      pieci: 0,
      pieci_ziemassvetki: 0,
    }

    this.lastSongs = {
      pieci_koncerti: null,
      pieci_atklajumi: null,
      pieci_latviesi: null,
      pieci_hiti: null,
      pieci: null,
      pieci_ziemassvetki: null,
    }

    this.cacheStillValid = false
    this.cacheInvalidationTimeout = null
  }

  attachStream(stream, station) {
    this.addToInterval(station)

    const publishUpdate = (data) => {
      stream.write('event: song\n' +
        'data: ' + JSON.stringify(data) + '\n\n')
    }

    if (this.lastSongs[station] !== null) {
      publishUpdate(this.lastSongs[station])
    }

    this.addListener(`song.${station}`, publishUpdate)

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
      this.removeListener(`song.${station}`, publishUpdate)
      this.removeFromInterval(station)
    })
  }

  addToInterval(station) {
    this.listeners[station] += 1
    if (this.nextTimeout === null) {
      this.startInterval()
    }
  }

  removeFromInterval(station) {
    this.listeners[station] -= 1
    if (_.reduce(this.listeners, (a, v) => a + v, 0) === 0) {
      clearTimeout(this.nextTimeout)
      this.nextTimeout = null
    }
  }

  startInterval() {
    let errorCount = 0
    const performPoll = () => {
      let ms = 9000 + Math.round(Math.random() * 6000)
      if (errorCount > 15) {
        L.error('Too many errors encountered while trying to fetch Pieci NP; ' +
          'aborting!')
        this.nextTimeout = null
        this.emit('errorCountExceeded')
        return
      } else if (errorCount > 3) {
        let addMs = 100 * Math.pow(2, errorCount - 3)
        L.warning('Many errors encountered while fetching Pieci NP; ' +
          'performing exponential backoff (currently at %d ms)', addMs)
        ms += addMs
      }
      this.nextTimeout = setTimeout(performPoll, ms)

      if (this.cacheStillValid) {
        return // leftover requests
      }

      this.fetchCurrentlyPlaying()
      .catch((e) => {
        L.warning('An error happened during fetching of Pieci NP:', e)
        errorCount++
      })
    }
    performPoll()
  }

  fetchCurrentlyPlaying() {
    let url
    {
      let listenedStations = [ ]
      _.forEach(this.listeners, (listenerCount, name) => {
        if (listenerCount > 0) {
          listenedStations.push(name)
        }
      })
      if (listenedStations.length === 0) {
        listenedStations = Object.keys(this.listeners)
      }
      let station = _.shuffle(listenedStations).pop()
      url = URLS[station]
    }

    return request({
      url: url,
      json: true,
    })
    .then((streams) => this.optionallyDispatchUpdates(streams))
  }

  optionallyDispatchUpdates(streams) {
    clearTimeout(this.cacheInvalidationTimeout)
    this.cacheInvalidationTimeout = setTimeout(() => {
      this.cacheStillValid = false
      this.cacheInvalidationTimeout = null
    }, 8750)
    this.cacheStillValid = true

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

        if (_.isEqual(song, this.lastSongs[stationName])) {
          continue
        } else {
          this.lastSongs[stationName] = song
          this.emit(`song.${stationName}`, song)
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

  findSongOnce(station) {
    if (this.cacheStillValid) {
      return Promise.resolve(this.lastSongs[station])
    } else {
      return this.fetchCurrentlyPlaying()
      .then(() => this.lastSongs[station])
    }
  }
}

module.exports = Pieci
