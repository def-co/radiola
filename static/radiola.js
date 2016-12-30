/*
 * P22 Radiola
 *
 * @version 1.1.0 (Simfonija)
 * @author paulsnar <paulsnar@paulsnar.lv>
 * @license © 2016 paulsnar. All Rights Reserved.
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
      current_song: null,
      current_program: null,
    },
    methods: {
      choice: function(p) {
        var i = Math.floor(Math.random() * p.length)
        return p[i]
      },
      changeActiveStation: function(i) {
        var self = this

        var station = findStation(i, this.stations)
        if (station._incompatible) {
          alert('Šo staciju nav iespējams atskaņot uz šīs ierīces.')
          return false
        }

        SF.unsubscribe(this.current_station)
        this.current_song = null
        this.current_program = null

        PM.switchStation(i)
        this.current_station = station.name
        this.playingState = 'BUFFERING'

        SF.eventbus.addListener('song.' + i, function(song) {
          if (song === null) { self.current_song = null }
          else { self.current_song = song.artist + ' – ' + song.title }
        })
        SF.eventbus.addListener('program.' + i, function(name) {
          self.current_program = name
        })
      },
      stop: function() {
        P22.Radiola.PlayManager.stop()
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

  fetch('/stations.json')
  .then(function(resp) { return resp.json() })
  .catch(function(e) {
    app.outsideDataState = 'ERROR'
    throw e
  })
  .then(function(json) {
    PM.init(json)

    for (var i = 0; i < json.stations.length; i++) {
      var station = json.stations[i]
      if (station.old_shoutcast) {
        if (PM.SUPPORTS_OLD_SHOUTCAST) { continue }
        else if (station.hls && PM.SUPPORTS_HLS) { continue }
        else { station._incompatible = true }
      }
    }

    app.stations = json.stations
    app.outsideDataState = 'LOADED'
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
