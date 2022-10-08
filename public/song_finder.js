/*
 * P22 Radiola
 *
 * @version 1.2.1 (Akords)
 * @author paulsnar <paulsnar@paulsnar.lv>
 * @license © 2016-2018 paulsnar. All Rights Reserved.
 */
(function() {
  'use strict';

  var DISCOVERABLE_STATIONS = {
    swh: true, swh_gold: true, swh_rock: true,
    star_fm: true,
    lr1: true, lr2: true, lr3: true, lr4: true,
    lr_naba: true,
    viegli: true, kurzemes: true, paradise: true,
    ehr: true, ehr_superhits: true, ehr_kh: true, ehr_summer: true,
      ehr_eurotop: true, ehr_fresh: true, ehr_latv_hiti: true,
      ehr_top_40: true, ehr_darbam: true, ehr_ritam: true, ehr_fitness: true,
      ehr_party_service: true, ehr_acoustic: true, ehr_alternative: true,
      ehr_dance: true, ehr_remix: true, ehr_urban: true, ehr_love: true,
  };

  var subscriptions = { };

  var eventbus = {
    _listeners: { },
    _onceListeners: { },
    on: function(name, callback) {
      if ( ! (name in this._listeners)) {
        this._listeners[name] = [ ];
      }
      this._listeners[name].push(callback);
    },
    once: function(name, callback) {
      if ( ! (name in this._onceListeners)) {
        this._onceListeners[name] = [ ];
      }
      this._onceListeners[name].push(callback);
    },
    off: function(name, callback) {
      if (name in this._listeners) {
        var event = this._listeners[name],
            index = event.indexOf(callback);
        if (index !== -1) {
          event.splice(index, 1);
        }
        if (event.length === 0) {
          delete this._listeners[name];
        }
      }
      if (name in this._onceListeners) {
        var event = this._onceListeners[name],
            index = event.indexOf(callback);
        if (index !== -1) {
          event.splice(index, 1);
        }
        if (event.length === 0) {
          delete this._onceListeners[name];
        }
      }
    },
    emit: function(name, data) {
      if (name in this._onceListeners) {
        var event = this._onceListeners[name];
        delete this._onceListeners[name];
        for (var i = 0, l = event.length; i < l; i += 1) {
          event[i](data);
        }
      }

      if (name in this._listeners) {
        var event = this._listeners[name].slice();
        for (var i = 0, l = event.length; i < l; i += 1) {
          event[i](data);
        }
      }
    },
    removeEvent: function(name) {
      if (name in this._listeners) {
        delete this._listeners[name];
      }
      if (name in this._onceListeners) {
        delete this._onceListeners[name];
      }
    },
  };

  var SongFinder = {
    eventbus: eventbus,

    canDiscover: function(station) {
      return station in DISCOVERABLE_STATIONS;
    },

    canSubscribe: function(station) {
      return SongFinder.canDiscover(station);
    },

    discover: function(station) {
      return fetch('/discover/current/' + station)
        .then(function(resp) { return resp.json(); });
    },

    subscribe: function(station) {
      if (station in subscriptions) {
        return subscriptions[station];
      }

      var es = new EventSource('/discover/subscribe/' + station);
      es.addEventListener('song', function(e) {
        var data = JSON.parse(e.data);
        eventbus.emit('song.' + station, data);
      });
      es.addEventListener('program', function(e) {
        var data = JSON.parse(e.data);
        eventbus.emit('program.' + station, data);
      });

      subscriptions[station] = es;
      return Promise.resolve(es);
    },

    unsubscribe: function(station) {
      if ( ! (station in subscriptions)) {
        return false;
      }

      subscriptions[station].close();
      delete subscriptions[station];

      eventbus.removeEvent('song.' + station);
      eventbus.removeEvent('program.' + station);
    },
  };

  window.P22.Radiola.SongFinder = SongFinder;
})()
