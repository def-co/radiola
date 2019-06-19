/*
 * P22 Radiola
 *
 * @version 1.1.7 (Simfonija)
 * @author paulsnar <paulsnar@paulsnar.lv>
 * @license © 2016-2018 paulsnar. All Rights Reserved.
 */
(function() {
  'use strict';

  var U = P22.Radiola.Utils;

  var PlayManager = { };

  var _listeners = { }, _onceListeners = { };

  function emit(name, data) {
    if (name in _onceListeners) {
      var handlers = _onceListeners[name];
      delete _onceListeners[name];
      for (var i = 0, l = handlers.length; i < l; i += 1) {
        handlers[i](data);
      }
    }
    if (name in _listeners) {
      var handlers = _listeners[name].slice();
      for (var i = 0, l = handlers.length; i < l; i += 1) {
        handlers[i](data);
      }
    }
  }

  function addListener(name, callback) {
    if ( ! (name in _listeners)) {
      _listeners[name] = [ ];
    }
    _listeners[name].push(callback);
  }
  PlayManager.addListener = addListener;

  var $el = document.createElement('audio');
  document.body.appendChild($el);
  $el.style.display = 'none';
  $el.autoplay = false;
  $el.preload = 'none';
  $el.volume = 1.0;

  PlayManager.supportsNativeHLS =
      $el.canPlayType('application/x-mpegURL') !== '';

  var $srcEl = document.createElement('source');
  $el.appendChild($srcEl);

  var stations = null, lastStation = null;
  PlayManager.playing = false;
  var renewSongInterval = null;
  var _notBuffering = false, _currentSong = null, _currentStation = null;
  var subscribed = false;

  $el.addEventListener('playing', function() {
    _notBuffering = true;
    emit('playing');
  });

  $el.addEventListener('stalled', function() {
    emit('stalled');
  });

  PlayManager.SUPPORTS_OLD_SHOUTCAST = !U.browser.safari;

  function init(_stations) {
    stations = { };
    _stations.forEach(function(station) {
      stations[station.id] = station;
    });

    return true;
  }
  PlayManager.init = init;

  function stop() {
    $el.src = '';
    $el.pause();
    emit('stopped');

    _currentSong = null;
    _currentStation = null;

    if (renewSongInterval !== null) {
      window.clearInterval(renewSongInterval);
    }
    PlayManager.playing = false;

    lastStation = null;
  }
  PlayManager.stop = stop;

  function switchStation(id) {
    if ( ! (id in stations)) {
      return false;
    }

    var station = stations[id];
    lastStation = id;

    if (station.old_shoutcast &&
        ! PlayManager.SUPPORTS_OLD_SHOUTCAST) {
      // For some goddamn reason Safari decides that the tab is open as a frame
      // and completely breaks it if the stream is coming from an non-HTTP/1.1
      // server (i.e. old_shoutcast) So we default to HLS immediately and not
      // even allow the other kind of request to happen, because that will
      // break the page entirely.
      if ('hls' in station) {
        $srcEl.src = station.hls;
        $el.src = station.hls;
        $el.play();
        return;
      } else {
        throw new Error('Cannot play station in Safari');
      }
    }

    $srcEl.src = station.stream_mp3;
    $el.src = station.stream_mp3;

    window.setTimeout(function() {
      PlayManager.playing = true;
      _notBuffering = false;
      Promise.resolve($el.play()).then(function() {}, function(e) {
        // AbortError occurs when a pending play() gets interrupted by pause()
        // It happens when buffering one station and switching to another, so
        // we just ignore it :)
        if (e.name === 'AbortError') { return true; }
        // NotSupportedError occurs most often when trying to play a stream
        // that cannot be interpreted by the browser's media stack
        // (i.e. old_shoutcast for Chrome/Safari). We might be able to fall
        // back to HLS, or we might not. I dunno :)
        if (e.name === 'NotSupportedError' && ('hls' in station)) {
          $srcEl.src = station.hls;
          $el.src = station.hls;
          $el.play();
          return;
        }
        emit('playingError', e.name, e);
        console.error('[PlayManager] Playing failed: (%s)', e.name, e);
      });
    }, 0);

    return station;
  }
  PlayManager.switchStation = switchStation;

  window.P22.Radiola.PlayManager = PlayManager;

})()
// vim: set ts=2 sts=2 et sw=2:
