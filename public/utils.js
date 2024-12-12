/*
 * P22 Radiola
 *
 * @version 1.2.0 (Akords)
 * @author paulsnar <paulsnar@paulsnar.lv>
 * @license © 2016-2018 paulsnar. All Rights Reserved.
 */
(function() {
  'use strict';

  var Utils = {
    browser: {
      // adapted from http://stackoverflow.com/a/9851769
      edge: !(/*@cc_on!@*/false || !!document.documentMode) && !!window.StyleMedia,
      safari: Object.prototype.toString.call(window.HTMLElement).indexOf('Constructor') > 0 || (function (p) { return p.toString() === "[object SafariRemoteNotification]"; })(!window['safari'] || safari.pushNotification),
      firefox: typeof InstallTrigger !== 'undefined',
      chrome: !!window.chrome && !!window.chrome.webstore,
    },

    stripQuotes: function(str) {
      if (str.indexOf('"') === 0) {
        str = str.substring(1);
        str = str.substring(0, str.length - 1);
      }
      return str;
    },

    isAbsoluteUrl: function(url) {
      return /^(?:\w{2,10}:)?(\/\/).*/i.test(url);
    },

    makeAbsoluteUrl: function(base, url) {
      var a = document.createElement('a');
      a.href = base;
      a.search = '';

      var parts = url.split('?');
      if (parts[0].substring(0, 1) === '/') {
        a.pathname = parts[0];
      } else {
        a.pathname += '/../' + parts[0];
      }
      if (parts[1] && parts[1].length) {
        a.search = '?' + parts[1];
        return a.href;
      } else {
        // weird safari bug (?) which appends ? still when search is empty
        return a.href.split('?')[0];
      }

    },

    event: function(name) {
      if (window.goatcounter) {
        window.goatcounter.count({
          event: true,
          path: name,
        });
      }
    },
  }

  var _intervals = [ ], _timeouts = [ ];
  Utils.TimerManager = {
    scheduleTimeout: function(func, timeout) {
      var i = _timeouts.push(null) - 1;
      _timeouts[i] = window.setTimeout(function() {
        _timeouts[i] = null;
        func();
      }, timeout);
      return i;
    },
    scheduleInterval: function(func, timeout) {
      var i = _intervals.push(null) - 1;
      _intervals[i] = window.setInterval(func, timeout);
      return i;
    },
    cancelTimeout: function(i) {
      clearTimeout(_timeouts[i]);
      _timeouts[i] = null;
    },
    cancelInterval: function(i) {
      clearInterval(_intervals[i]);
      _intervals[i] = null;
    },
    cancelAll: function() {
      for (var i = 0; i < _intervals.length; i++) {
        if (_intervals[i] !== null) { clearInterval(_intervals[i]); }
      }
      for (var i = 0; i < _timeouts.length; i++) {
        if (_timeouts[i] !== null) { clearTimeout(_timeouts[i]); }
      }

      _intervals = [ ];
      _timeouts = [ ];
    },
  }

  window.P22.Radiola.Utils = Utils;
})()
// vim: set ts=2 sts=2 et sw=2:
