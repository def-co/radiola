/*
 * P22 Radiola
 *
 * @version 1.0.12
 * @author paulsnar <paulsnar@paulsnar.lv>
 * @license © 2016 paulsnar. All Rights Reserved.
 */
(function() {
  'use strict';

  var app = new Vue({
    el: '#js__app',
    data: {
      compatibility_issues: false,
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
      stop: function() {
        P22.Radiola.PlayManager.stop()
        this.$set(this, 'currently_playing', false)
      },
      dismissCompatibilityAlert: function() {
        this.$set(this, 'compatibility_issues', false)
      },
      hideUnplayableStations: function() {
        this.dismissCompatibilityAlert()
        var stations = this.stations.filter(function(station) {
          return station.stream.old_shoutcast === false
        })
        this.$set(this, 'stations', stations)
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

  if (window.safari) {
    // Safari refuses to play SHOUTcast, since it interprets its weird ICY 200
    // headers as HTTP/0.9, therefore refusing to load it as a resource. 
    // There's no real workaround, apart from rehosting the stream, which I'm
    // not that keen on.
    Vue.set(app, 'compatibility_issues', true)
  }

  fetch('stations.json')
  .then(function(resp) { return resp.json() })
  .catch(function(e) {
    Vue.set(app, 'loaded', true)
    Vue.set(app, 'loaded_error', true)
    throw e
  })
  .then(function(json) {
    json.stations = json.stations
      .filter(function(station) { return !station.__skip })
    P22.Radiola.PlayManager.init(json)
    Vue.set(app, 'stations', json.stations)
    Vue.set(app, 'loaded', true)
  })

  P22.Radiola.PlayManager.onSongRenewal = function(data) {
    app.updateSongStatus(data)
  }

})()
// vim: set ts=2 sts=2 et sw=2:
