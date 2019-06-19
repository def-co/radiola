/*
 * P22 Radiola
 *
 * @version 1.2.0 (Akords)
 * @author paulsnar <paulsnar@paulsnar.lv>
 * @license © 2016-2018 paulsnar. All Rights Reserved.
 */
(function(cont) {
  'use strict';

  fetch('/stations.json')
  .then(function(resp) { return resp.json(); })
  .then(function(stations) {
    cont(stations);
  }, function(err) {
    console.error('Loading failed:', err);
    cont(null);
  });
})(function(stations) {
  'use strict';

  var PM = P22.Radiola.PlayManager, SF = P22.Radiola.SongFinder;

  stations = stations.map(function(station) {
    if (station.old_shoutcast) {
      if ( ! PM.supportsOldShoutcast &&
           ! (station.hls && PM.supportsNativeHLS)) {
        station._incompatible = true;
      }
    }
    return station;
  });

  var PlayingState = {
    PLAYING: 'PLAYING',
    BUFFERING: 'BUFFERING',
    STALLED: 'STALLED',
    STOPPED: 'STOPPED',
    ERROR: 'ERROR',
  };

  function findStation(id, stations) {
    var station = null;
    for (var i = 0; i < stations.length; i++) {
      if (stations[i].id === id) { station = stations[i]; }
    }
    return station;
  }

  var app = new Vue({
    el: '#js__app',
    template: document.getElementById('app-template').textContent,
    data: {
      version: P22.Radiola.VERSION,
      playingState: PlayingState.STOPPED,
      stations: stations,
      currentStation: { id: null },
      currentSong: null,
      currentProgram: null,
    },
    methods: {
      choice: function(p) {
        var i = Math.floor(Math.random() * p.length);
        return p[i];
      },
      changeActiveStation: function(stationId) {
        var self = this;

        var station = findStation(stationId, this.stations);
        if (station._incompatible) {
          alert(station.name + ' nav iespējams atskaņot uz šīs ierīces.');
          return false;
        }

        if (this.playingState !== PlayingState.STOPPED) {
          this.stop();
        }

        this.currentSong = null;
        this.currentProgram = null;

        this.currentStation = station;
        this.playingState = PlayingState.BUFFERING;

        if (SF.canSubscribe(stationId)) {
          SF.eventbus.on('song.' + stationId, function(song) {
            self.currentSong = song;
          })
          SF.eventbus.on('program.' + stationId, function(name) {
            self.currentProgram = name;
          })
          SF.subscribe(stationId);
          this._subscribed = true;
        }

        PM.switchStation(station);
      },
      stop: function() {
        PM.stop();
        if (this._subscribed) {
          SF.unsubscribe(this.currentStation.id);
          this._subscribed = false;
        }

        this.currentStation = { id: null };
        this.currentSong = null;
        this.currentProgram = null;
      },
    },
    components: {
      'radiola-station': {
        props: ['station', 'active'],
        data: function() {
          return { station: this.station, active: this.active };
        },
        methods: {
          handleClicked: function() {
            this.$emit('clicked');
          }
        },
        template: [
          '<div',
              'class="card"',
              ':class="{ \'station-incompatible\': station._incompatible, active: active }"',
              'v-on:click="handleClicked">',
            '<img :src="station.logo" alt="" />',
            '<p class="text-center">',
              '{{ station.name }}',
            '</p>',
          '</div>',
        ].join(' '),
      },
    },
  });

  var $title = document.getElementsByTagName('title')[0];
  app.$watch(function() {
    var title = '';

    switch (this.playingState) {
      case PlayingState.BUFFERING:
      case PlayingState.STALLED:
        title += '… ';
        break;

      case PlayingState.PLAYING:
        title += '▶ ';
        break;
    }

    if (this.currentSong) {
      title += this.currentSong.artist + ' - ' +
        this.currentSong.title + ' :: ';
    }

    if (this.currentStation.id !== null) {
      title += this.currentStation.name;
      title += ' :: ';
    }

    title += 'P22 Radiola';
    return title;
  }, function(newTitle) {
    $title.textContent = newTitle;
  }, { immediate: true });


  PM.addEventListener('playing', function() {
    app.playingState = PlayingState.PLAYING;
  });

  PM.addEventListener('stalled', function() {
    if (PM.mode === 'HLS') {
      return;
    }
    app.playingState = PlayingState.STALLED;
  });

  PM.addEventListener('stopped', function() {
    app.playingState = PlayingState.STOPPED;
  });

  PM.addEventListener('error', function() {
    app.playingState = PlayingState.ERROR;
  });

  window.P22.Radiola.App = app;
})
// vim: set ts=2 sts=2 et sw=2:
