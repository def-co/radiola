/*
 * P22 Radiola
 *
 * @version 1.1.0 (Simfonija)
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
      } else if (!('EventSource' in window)) {
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

      if (!('EventSource' in window)) {
        return Promise.reject(
          new TypeError('EventSource not supported'))
      }

      if (station in SUBSCRIPTIONS) { return SUBSCRIPTIONS[station] }

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
      SUBSCRIPTIONS[station] = es

      return Promise.resolve(true)
    },

    unsubscribe: function(station) {
      if (!(station in SUBSCRIPTIONS)) return false

      SUBSCRIPTIONS[station].close()
      delete SUBSCRIPTIONS[station]

      SongFinder.eventbus.removeEvent('song.' + station)
      SongFinder.eventbus.removeEvent('program.' + station)
      SongFinder.eventbus.removeEvent('stream_error.' + station)

      return true
    },
  }

  window.P22.Radiola.SongFinder = SongFinder
})()
