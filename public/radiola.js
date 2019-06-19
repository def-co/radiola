/*
 * P22 Radiola
 *
 * @version 1.1.7 (Simfonija)
 * @author paulsnar <paulsnar@paulsnar.lv>
 * @license © 2016-2018 paulsnar. All Rights Reserved.
 */
(function(cont) {
  'use strict';

  fetch('/stations.json')
  .then(function(resp) { return resp.json(); })
  .then(cont);
})(function(stations) {
  'use strict';

  var PM = P22.Radiola.PlayManager, SF = P22.Radiola.SongFinder;

  var template = document.getElementById('app-template').textContent;

  function findStation(id, stations) {
    var station = null;
    for (var i = 0; i < stations.length; i++) {
      if (stations[i].id === id) { station = stations[i]; }
    }
    return station;
  }

  var app = new Vue({
    el: '#js__app',
    template: template,
    data: {
      version: P22.Radiola.VERSION,
      loadError: false,
      playingState: 'STOPPED',
      bufferingError: false,
      stations: stations,
      currentStation: null,
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

        if (this.playingState !== 'STOPPED') {
          this.stop();
        }

        this.currentSong = null;
        this.currentProgram = null;

        this.currentStation = station;
        this.playingState = 'BUFFERING';

        if (SF.canSubscribe(stationId)) {
          this._subscribed = true;
          SF.eventbus.on('song.' + stationId, function(song) {
            self.currentSong = song;
          })
          SF.eventbus.on('program.' + stationId, function(name) {
            self.currentProgram = name;
          })
          SF.subscribe(stationId);
        }

        PM.switchStation(stationId);
      },
      stop: function() {
        P22.Radiola.PlayManager.stop();
        if (this._subscribed) {
          SF.unsubscribe(this.currentStation.id);
          this._subscribed = false;
        }

        this.currentStation = null;
        this.currentSong = null;
        this.currentProgram = null;
      },
    },
    components: {
      'radiola-station': {
        props: ['station'],
        data: function() {
          return { station: this.station };
        },
        methods: {
          handleClicked: function() {
            this.$emit('clicked');
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
        ].join(' '),
      },
    },
  })

  // fetch('/stations.json')
  // .then(function(resp) { return resp.json(); })
  // .then(function(stations) {
  //   PM.init(stations);

    for (var i = 0; i < stations.length; i++) {
      var station = stations[i];
      if (station.old_shoutcast) {
        if (PM.SUPPORTS_OLD_SHOUTCAST) { continue; }
        else if (station.hls && PM.supportsNativeHLS) { continue; }
        else { station._incompatible = true; }
      }
    }

  //   app.stations = stations;
  //   app.outsideDataState = 'LOADED';

  //   if (window.location.hash !== '') {
  //     var st = window.location.hash.replace('#', '');
  //     if (findStation(st, json.stations) !== null) {
  //       app.changeActiveStation(st);
  //     }
  //   }
  // }, function(e) {
  //   app.outsideDataState = 'ERROR';
  // });

  PM.init(stations);


  var _titleEl = document.getElementsByTagName('title')[0];
  app.$watch(function() {
    var title = '';

    switch (this.playingState) {
      case 'BUFFERING':
      case 'STALLED':
        title += '… ';
        break;

      case 'PLAYING':
        title += '▶ ';
        break;
    }

    if (this.current_song) {
      title += this.current_song;
    }
    if (this.current_song && this.current_program) {
      title += ' :: ';
    }
    if (this.current_program) {
      title += this.current_program;
    }

    if ((this.current_song || this.current_program) && this.current_station) {
      title += ' :: ';
    }

    if (this.current_station) {
      title += this.current_station;
      title += ' :: ';
    }

    title += 'P22 Radiola';
    return title;
  }, function(newTitle) {
    _titleEl.textContent = newTitle;
  }, { immediate: true });


  PM.addListener('playing', function() {
    app.playingState = 'PLAYING';
  });

  PM.addListener('stalled', function() {
    if (!app.buffering_stalled) {
      app.playingState = 'STALLED';
    }
  });

  PM.addListener('stopped', function() {
    app.playingState = 'STOPPED';
    app.current_song = null;
    app.current_program = null;
  });

  PM.addListener('playingError', function() {
    app.playingState = 'ERROR';
  });

  window.P22.Radiola.App = app;
})
// vim: set ts=2 sts=2 et sw=2:
