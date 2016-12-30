/*
 * P22 Radiola
 *
 * @version 1.1.0 (Simfonija)
 * @author paulsnar <paulsnar@paulsnar.lv>
 * @license © 2016 paulsnar. All Rights Reserved.
 */
(function() {
  'use strict';

  /*
    [!] Telemetry Notice

    I understand that you might not want to send telemetry information for
    whatever reasons (I use such optouts quite often), therefore there is a way
    to opt out of sending any nonrequired data if you want to. The telemetry
    information sent is only used for statistics and error reporting, and will
    not be used to personally identify you or any other user. Therefore I hope
    that you will at least switch to MINIMAL mode, but if you must, you can opt
    out completely.

    To opt out:
    - Install an user script runner, such as Greasemonkey or Tampermonkey
    - Create a new userscript which runs on the 'load' event
    - In the main function body, set either window.P22.Radiola._s.MINIMAL
      or window.P22.Radiola._s.OPTOUT to true. Depending on the specific
      script environment, you might have to use unsafeWindow instead.
      (After load you can set window.P22.Radiola.Telemetry.MINIMAL and
      window.P22.Radiola.Telemetry.OPTOUT as well, those are linked.)

    Levels explained:
    - MINIMAL level only sends information about unhandled errors and stream
      problems. It disables sending of usage stats and performance reports.
      Only the stack trace and error message of an exception will be sent. That
      might include information about which station you were listening to.
    - OPTOUT disables all telemetry, including error reports.

    If you are worried about your IP address, use Tor if you still don't.
  */

  var _initialData = window.P22.Radiola._s
  delete window.P22.Radiola._s
  _initialData.scriptLoad = _perftime()

  var BEACON_URL = '/_/frontend/sink',
      ERROR_URL = '/_/frontend/errors'

  var _pendingEvents = { }, _stations = { }, _sessionStart = null,
      _uniqueStations = { }

  function noop() { /* noop */ }

  var Telemetry = {
    OPTOUT: _initialData.OPTOUT || false,
    MINIMAL: _initialData.MINIMAL || false,

    init: function() {
      if (Telemetry.OPTOUT) {
        console.log('[Telemetry] Telemetry is disabled.')
      } else if (Telemetry.MINIMAL) {
        console.log('[Telemetry] Telemetry is partially enabled (minimal mode).')
      } else {
        console.log('[Telemetry] Telemetry is enabled. ' +
          'Please see telemetry.js for telemetry notice.')
      }

      var now = _sessionStart = _perftime()

      Telemetry.beacon({
        sq: 0,
        type: 'loadperf',
        data: [
          now - _initialData.scriptLoad,
          _initialData.scriptLoad - _initialData.pageLoadStart,
        ],
      })

      setTimeout(function() {
        Telemetry.beacon({
          sq: 1,
          type: 'features',
          data: {
            eventsource: 'EventSource' in window,
            old_shoutcast: P22.Radiola.PlayManager.SUPPORTS_OLD_SHOUTCAST,
            hls: P22.Radiola.PlayManager.SUPPORTS_HLS,
            beacon: 'sendBeacon' in navigator,
          },
        })
      }, 0)
    },

    beacon: function(data, force) {
      if (Telemetry.OPTOUT || Telemetry.MINIMAL) return null

      if ('sendBeacon' in navigator) {
        return navigator.sendBeacon(BEACON_URL, JSON.stringify(data))
      } else {
        fetch(BEACON_URL, {
          method: 'POST',
          body: JSON.stringify(data)
        })
        return false
      }
    },

    station: {
      start: function(id) {
        _stations[id] = _perftime()
        _uniqueStations[id] = true
      },
      playing: function(id) {
        var stattime = _perftime() - _stations[id]
        delete _stations[id]

        Telemetry.beacon({
          sq: 7,
          type: 'fmstinit',
          data: [id, stattime],
        })
      },
      stalled: noop,
      stop: noop,
    },

    sendFinal: function() {
      var _sessionTime = _perftime() - _sessionStart
      Telemetry.beacon({
        sq: 12,
        type: 'session$',
        data: [_sessionTime, Object.keys(_uniqueStations).length],
      })
    },

    sendError: function(e) {
      var data = {
        sq: 5,
        type: 'uncaught',
        data: {
          stack: e.error.stack,
          str: e.message,
          file: e.filename,
          loc: e.lineno + ':' + e.colno,
        }
      }
      if ('sendBeacon' in navigator) {
        navigator.sendBeacon(ERROR_URL, JSON.stringify(data))
      } else {
        fetch(ERROR_URL, {
          method: 'POST',
          body: JSON.stringify(data),
        })
      }
    }
  }

  window.addEventListener('unload', function() {
    Telemetry.sendFinal()
  })

  window.addEventListener('error', function(e) {
    Telemetry.sendError(e)
  })

  window.P22.Radiola.Telemetry = Telemetry
})()
