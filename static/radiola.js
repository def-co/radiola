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

  function filterIncompatibleStations(allStations) {
    var compatibleStations = [ ]
    for (var i = 0; i < allStations.length; i++) {
      var station = allStations[i]
      if (PM.SUPPORTS_OLD_SHOUTCAST && station.old_shoutcast) {
        compatibleStations.push(station)
      }
      if (PM.SUPPORTS_HLS && station.hls) {
        compatibleStations.push(station)
      }
      if (!station.old_shoutcast) {
        compatibleStations.push(station)
      }
    }
    return compatibleStations
  }

  var app = new Vue({
    el: '#js__app',
    template: _AppTemplate,
    data: {
      compatibility_issues: false,
      buffering: false,
      buffering_error: false,
      loaded: false,
      loaded_error: false,
      stations: null,
      currently_playing: false,
      current_song: null,
    },
    methods: {
      changeActiveStation: function(i) {
        var station = PM.switchStation(i)
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
      dismissCompatibilityAlert: function() {
        this.$set(this, 'compatibility_issues', false)
      },
      hideUnplayableStations: function() {
        this.dismissCompatibilityAlert()
        var stations = filterIncompatibleStations(this.stations)
        this.$set(this, 'stations', stations)
        localStorage.setItem('hideUnplayable', 'true')
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

  if ((window.safari || (window.chrome && window.chrome.runtime)) &&
      !localStorage.getItem('hideUnplayable')) {
    // Safari refuses to play SHOUTcast, since it interprets its weird ICY 200
    // headers as HTTP/0.9, therefore refusing to load it as a resource.
    // There's no real workaround, apart from rehosting the stream, which I'm
    // not that keen on.
    Vue.set(app, 'compatibility_issues', true)
  }

  fetch('/stations.json')
  .then(function(resp) { return resp.json() })
  .catch(function(e) {
    Vue.set(app, 'loaded', true)
    Vue.set(app, 'loaded_error', true)
    throw e
  })
  .then(function(json) {
    json.stations = json.stations
      .filter(function(station) { return !station.__skip })
    PM.init(json)
    Vue.set(app, 'stations', json.stations)
    Vue.set(app, 'loaded', true)

    if ((window.safari || (window.chrome && window.chrome.runtime)) &&
        localStorage.getItem('hideUnplayable')) {
      app.hideUnplayableStations()
    }
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
})
// vim: set ts=2 sts=2 et sw=2:
