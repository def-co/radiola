/*
 * P22 Radiola
 *
 * @version 1.1.7 (Simfonija)
 * @author paulsnar <paulsnar@paulsnar.lv>
 * @license © 2016-2018 paulsnar. All Rights Reserved.
 */
(function(cont) {
  'use strict';

  fetch('app.tmpl.html')
  .then(function(resp) { return resp.text() })
  .then(cont)
})(function(_AppTemplate) {
  'use strict';

  var PM = P22.Radiola.PlayManager, SF = P22.Radiola.SongFinder

  function findStation(id, stations) {
    var station = null
    for (var i = 0; i < stations.length; i++) {
      if (stations[i].id === id) { station = stations[i] }
    }
    return station
  }

  var app = new Vue({
    el: '#js__app',
    template: _AppTemplate,
    data: {
      outsideDataState: 'WAITING',
      playingState: 'STOPPED',
      stations: [ ],
      current_station: null,
      current_station_id: null,
      current_song: null,
      current_program: null,
      _subscribed: false,
    },
    methods: {
      choice: function(p) {
        var i = Math.floor(Math.random() * p.length)
        return p[i]
      },
      changeActiveStation: function(stationId) {
        var self = this

        var station = findStation(stationId, this.stations)
        if (station._incompatible) {
          alert(station.name + ' nav iespējams atskaņot uz šīs ierīces.')
          return false
        }

        if (this.playingState !== 'STOPPED') {
          this.stop()
        }

        this.current_song = null
        this.current_program = null

        PM.switchStation(stationId)
        this.current_station_id = stationId
        this.current_station = station.name
        this.playingState = 'BUFFERING'

        SF.canSubscribe(stationId)
        .then(function(canSubscribe) {
          if (canSubscribe) {
            self._subscribed = true
            SF.eventbus.addListener('song.' + stationId, function(song) {
              if (song === null) { self.current_song = null }
              else { self.current_song = song.artist + ' – ' + song.title }
            })
            SF.eventbus.addListener('program.' + stationId, function(name) {
              self.current_program = name
            })
            SF.subscribe(stationId)
          }
        })
      },
      showDebugInfo: function() {
        var msg = [
          'P22 Radiola v1.1.7',
          'Telemetryless'
        ]

        alert(msg.join('\n'))
      },
      stop: function() {
        P22.Radiola.PlayManager.stop()
        if (this._subscribed) {
          SF.unsubscribe(this.current_station_id)
          this._subscribed = false
        }

        this.current_station = null
        this.current_station_id = null
        this.current_song = null
        this.current_program = null
      },
    },
    components: {
      'pr-station': {
        props: ['station'],
        data: function() {
          return { station: this.station }
        },
        methods: {
          handleClicked: function() {
            this.$emit('clicked')
          }
        },
        template: [
          '<div',
              'class="card"',
              ':class="{ \'station-incompatible\': station._incompatible }"',
              'v-on:click="handleClicked">',
            '<img :src="station.logo" alt="" />',
            '<p class="text-center">',
              '{{ station.name }}',
            '</p>',
          '</div>',
        ].join(' ')
      }
    }
  })

  Promise.all([
    fetch('/stations.json')
      .then(function(resp) { return resp.json() }),
    P22.Radiola.HLS.supportsHLS,
  ])
  .then(function(all) {
    var stations = all[0], supportsHLS = all[1]

    PM.init(json)

    for (var i = 0; i < stations.length; i++) {
      var station = stations[i]
      if (station.old_shoutcast) {
        if (PM.SUPPORTS_OLD_SHOUTCAST) { continue }
        else if (station.hls && supportsHLS) { continue }
        else { station._incompatible = true }
      }
    }

    app.stations = stations
    app.outsideDataState = 'LOADED'

    if (window.location.hash !== '') {
      var st = window.location.hash.replace('#', '')
      if (findStation(st, json.stations) !== null) {
        app.changeActiveStation(st)
      }
    }
  }, function(e) {
    app.outsideDataState = 'ERROR'
  })

  var _titleEl = document.getElementsByTagName('title')[0]
  app.$watch(function() {
    var title = ''

    switch (this.playingState) {
      case 'BUFFERING':
      case 'STALLED':
        title += '… '
        break

      case 'PLAYING':
        title += '▶ '
        break
    }

    if (this.current_song) {
      title += this.current_song
    }
    if (this.current_song && this.current_program) {
      title += ' :: '
    }
    if (this.current_program) {
      title += this.current_program
    }

    if ((this.current_song || this.current_program) && this.current_station) {
      title += ' :: '
    }

    if (this.current_station) {
      title += this.current_station
      title += ' :: '
    }

    title += 'P22 Radiola'
    return title
  }, function(newTitle) {
    _titleEl.textContent = newTitle
  }, { immediate: true })


  PM.addListener('playing', function() {
    app.playingState = 'PLAYING'
  })

  PM.addListener('stalled', function() {
    // HLS will show the source as stalled *way* too often, so we just ignore
    // that
    if (PM._hlsPlaylist) return

    if (!app.buffering_stalled) {
      app.playingState = 'STALLED'
    }
  })

  PM.addListener('stopped', function() {
    app.playingState = 'STOPPED'
    app.current_song = null
    app.current_program = null
  })

  PM.addListener('playingError', function() {
    app.playingState = 'ERROR'
  })

  window.P22.Radiola.App = app
})
// vim: set ts=2 sts=2 et sw=2:
