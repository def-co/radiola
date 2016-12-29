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

  var PM = P22.Radiola.PlayManager

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
      buffering: false,
      buffering_error: false,
      loaded: false,
      loaded_error: false,
      stations: [ ],
      currently_playing: false,
      current_song: null,
    },
    methods: {
      changeActiveStation: function(i) {
        var station = findStation(i, this.stations)
        if (station._incompatible) {
          alert('Šo staciju nav iespējams atskaņot uz šīs ierīces.')
          return false
        }
        station = PM.switchStation(i)
        this.$set(this, 'currently_playing', station)
        this.$set(this, 'buffering_error', false)
        this.$set(this, 'buffering', true)
      },
      updateSongStatus: function(data) {
        if (data === null) this.current_song = null
        else this.current_song = data.artist + ' - ' + data.title
      },
      stop: function() {
        P22.Radiola.PlayManager.stop()
        this.$set(this, 'currently_playing', false)
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
              'class="thumbnail"',
              ':class="{ \'station-incompatible\': station._incompatible }"',
              'v-on:click="handleClicked">',
            '<img :src="station.logo" alt="" />',
            '<p',
                'class="text-center"',
                'style="font-weight: bold">',
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
    Vue.set(app, 'loaded', true)
    Vue.set(app, 'loaded_error', true)
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

    Vue.set(app, 'stations', json.stations)
    Vue.set(app, 'loaded', true)
  })

  PM.addListener('song_renewed', function(data) {
    app.updateSongStatus(data)
  })

  PM.addListener('playing', function() {
    Vue.set(app, 'buffering', false)
  })

  PM.addListener('stopped', function() {
    app.updateSongStatus(null)
  })

  PM.addListener('playingError', function() {
    Vue.set(app, 'buffering', false)
    Vue.set(app, 'buffering_error', true)
  })

  window.P22.Radiola.App = app
})
// vim: set ts=2 sts=2 et sw=2:
