/*
 * P22 Radiola
 *
 * @version 1.1.5 (Simfonija)
 * @author paulsnar <paulsnar@paulsnar.lv>
 * @license © 2016-2017 paulsnar. All Rights Reserved.
 */
(function() {
  'use strict';

  var SongFinder = {
    eventbus: new EventEmitter(),

    canDiscover: function(station) {
      return Promise.resolve(false) 
    },

    discover: function(station) {
      return Promise.reject(
        new Error('Discovery is temporarily disabled'))
    },

    canSubscribe: function(station) {
      return Promise.resolve(false)
    },

    subscribe: function(station) {
      return Promise.reject(
        new Error('Discovery is temporarily disabled'))
    },

    unsubscribe: function(station) {
      return false
    },
  }

  window.P22.Radiola.SongFinder = SongFinder
})()
