/*
 * P22 Radiola
 *
 * @version 1.1.3 (Simfonija)
 * @author paulsnar <paulsnar@paulsnar.lv>
 * @license © 2016-2017 paulsnar. All Rights Reserved.
 */
(function() {
  'use strict';

  var SONG_FINDABLE_CACHE = { },
      SUBSCRIPTIONS = { },
      isDiscoverable = function(station) {
        return SONG_FINDABLE_CACHE[station][0] ||
          SONG_FINDABLE_CACHE[station][1]
      },
      SongFinder = {
    eventbus: new EventEmitter(),

    canDiscover: function(station) {
      if (station in SONG_FINDABLE_CACHE) {
        return Promise.resolve(SONG_FINDABLE_CACHE[station])
      } else {
        return fetch('/discover/' + station)
        .then(function(r) { return r.json() })
        .then(function(resp) {
          // console.log('[SongFinder] %O', resp)
          SONG_FINDABLE_CACHE[station] =
            [resp.can_find_song, resp.can_find_program]
          return resp.can_find_song || resp.can_find_program
        })
      }
    },

    discover: function(station) {
      if (!(station in SONG_FINDABLE_CACHE)) {
        return SongFinder.canFindSong(station)
        .then(function(s) {
          if (!s) {
            return Promise.reject(
              new Error('Station does not support discovery'))
          } else {
            return SongFinder.findSong(station)
          }
        })
      } else if (!isDiscoverable(station)) {
        return Promise.reject(
          new Error('Station does not support discovery'))
      }
      return fetch('/discover/now/' + station)
      .then(function(r) { return r.json() })
      .then(function(resp) {
        if (resp.ok) {
          return resp.data
        } else {
          throw new Error(resp)
        }
      })
    },

    canSubscribe: function(station) {
      if (!(station in SONG_FINDABLE_CACHE)) {
        return SongFinder.canDiscover(station)
        .then(function(s) {
          if (!s) {
            return false
          } else {
            return SongFinder.canSubscribe(station)
          }
        })
      } else if (!isDiscoverable(station)) {
        return Promise.resolve(false)
      } else {
        return Promise.resolve(true)
      }
    },

    subscribe: function(station) {
      if (!(station in SONG_FINDABLE_CACHE)) {
        return SongFinder.canDiscover(station)
        .then(function(s) {
          if (!s) {
            return Promise.reject(
              new Error('Station does not support discovery'))
          } else {
            return SongFinder.subscribe(station)
          }
        })
      } else if (!isDiscoverable(station)) {
        return Promise.reject(
          new Error('Station does not support discovery'))
      }

      if (station in SUBSCRIPTIONS) { return SUBSCRIPTIONS[station] }

      if (!('EventSource' in window)) {
        return SongFinder._startPollingFallback(station)
      }

      var lastSong = null, lastProgram = null

      var es = new EventSource('/discover/hose/' + station)
      es.addEventListener('song', function(e) {
        var data = JSON.parse(e.data)
        if (lastSong === null ||
          (lastSong.artist !== data.artist &&
          lastSong.title !== data.title)) {
          lastSong = data
          SongFinder.eventbus.emit('song.' + station, data)
        // } else {
        //   console.log('[SongFinder] stream restart artifact (same song emitted)')
        }
      })
      es.addEventListener('program', function(e) {
        var data = JSON.parse(e.data)
        if (lastProgram !== data) {
          SongFinder.eventbus.emit('program.' + station, data)
        }
      })
      es.addEventListener('stream_error', function(e) {
        var data = JSON.parse(e.data)
        SongFinder.eventbus.emit('stream_error.' + station, data)
      })
      SUBSCRIPTIONS[station] = { type: 'eventsource', es: es }

      return Promise.resolve(SUBSCRIPTIONS[station])
    },

    unsubscribe: function(station) {
      if (!(station in SUBSCRIPTIONS)) return false

      var sub = SUBSCRIPTIONS[station]

      if (sub.type === 'eventsource') {
        sub.es.close()
      } else if (sub.type === 'polling') {
        clearTimeout(sub.timeout)
      }

      delete SUBSCRIPTIONS[station]

      SongFinder.eventbus.removeEvent('song.' + station)
      SongFinder.eventbus.removeEvent('program.' + station)
      SongFinder.eventbus.removeEvent('stream_error.' + station)

      return true
    },

    _startPollingFallback: function(station) {
      var _lastSong = null, _lastProgram = null

      var POLLER_TIMEOUT = 8250

      SUBSCRIPTIONS[station] = {
        type: 'polling',
        timeout: null,
      }

      var poller = function poller() {
        return SongFinder.discover(station)
        .then(function(data) {
          if (data.program !== _lastProgram) {
            _lastProgram = data.program
            SongFinder.eventbus.emit('program.' + station, data.program)
          }
          if (_lastSong === null ||
            (data.song.artist !== _lastSong.artist ||
              data.song.title !== _lastSong.title)) {
            _lastSong = data.song
            SongFinder.eventbus.emit('song.' + station, data.song)
          }

          if (station in SUBSCRIPTIONS) {
            SUBSCRIPTIONS[station].timeout = setTimeout(poller, POLLER_TIMEOUT)
          }
        })
      }

      poller()

      return poller()
      .then(function() {
        return SUBSCRIPTIONS[station]
      })
    },

    _SUBS: SUBSCRIPTIONS
  }

  window.P22.Radiola.SongFinder = SongFinder
})()
