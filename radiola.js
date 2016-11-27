/*
 * P22 Radiola
 *
 * @author paulsnar <paulsnar@paulsnar.lv>
 * @license © 2016 paulsnar. All Rights Reserved.
 */
(function() {
  'use strict';

  var app = new Vue({
    el: '#js__app',
    data: {
      loaded: false,
      loaded_error: false,
      stations: null,
      currently_playing: false,
      current_song: null,
    },
    methods: {
      changeActiveStation: function(i) {
        var station = P22.Radiola.PlayManager.switchStation(i)
        this.$set(this, 'currently_playing', station)
      },
      updateSongStatus: function(data) {
        if (data === null) this.current_song = null
        else this.current_song = data.artist + ' - ' + data.title
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
              'v-bind:class="{ thumbnail: true }"',
              'v-on:click="handleClicked">',
            '<img :src="station.logo" alt="" />',
            '<h4>{{ station.name }}</h4>',
          '</div>',
        ].join(' ')
      }
    }
  })


  fetch('stations.json')
  .then(function(resp) { return resp.json() })
  .catch(function(e) {
    app.loaded = true
    app.loaded_error = true

    throw e
  })
  .then(function(json) {
    json.stations = json.stations
      .filter(function(station) { return !station.__skip })
    P22.Radiola.PlayManager.init(json)
    app.stations = json.stations
    app.loaded = true
  })

  P22.Radiola.PlayManager.onSongRenewal = function(data) {
    app.updateSongStatus(data)
  }

})()
