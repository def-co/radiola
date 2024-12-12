/*
 * P22 Radiola
 *
 * @version 1.2.0 (Akords)
 * @author paulsnar <paulsnar@paulsnar.lv>
 * @license © 2016-2018 paulsnar. All Rights Reserved.
 */
(function() {
  'use strict';

  var PlayingMode = {
    MP3: 'MP3',
    HLS: 'HLS',
  };

  var events = {
    listeners: { },
    oneTimeListeners: { },

    emit: function(name, data) {
      if (name in this.oneTimeListeners) {
        var handlers = this.oneTimeListeners[name];
        delete this.oneTimeListeners[name];
        for (var i = 0, l = handlers.length; i < l; i += 1) {
          handlers[i](data);
        }
      }
      if (name in this.listeners) {
        var handlers = this.listeners[name].slice();
        for (var i = 0, l = handlers.length; i < l; i += 1) {
          handlers[i](data);
        }
      }
    },

    on: function(name, callback) {
      var handlers = this.listeners[name] || (this.listeners[name] = [ ]);
      handlers.push(callback);
    },

    once: function(name, callback) {
      var handlers = this.oneTimeListeners[name] ||
        (this.oneTimeListeners[name] = [ ]);
      handlers.push(callback);
    },

    off: function(name, callback) {
      if (name in this.listeners) {
        var handlers = this.listeners[name],
            index = handlers.indexOf(callback);
        if (index !== -1) {
          handlers.splice(index, 1);
        }
      }
      if (name in this.oneTimeListeners) {
        var handlers = this.oneTimeListeners[name],
            index = handlers.indexOf(callback);
        if (index !== -1) {
          handlers.splice(index, 1);
        }
      }
    },
  };

  var PlayManager = P22.Radiola.PlayManager = {
    PlayingMode: PlayingMode,

    playing: false,
    mode: null,
    addEventListener: events.on.bind(events),
    removeEventListener: events.off.bind(events),
    addOneTimeEventListener: events.once.bind(events),

    el: (function() {
      var el = document.createElement('audio');
      el.autoplay = false;
      el.preload = 'none';
      el.volume = 1.0;
      return el;
    })(),

    stop: function() {
      this.el.pause();
      this.el.src = '';
      events.emit('stopped');
      this.playing = false;
      this.mode = null;
    },

    switchStation: function(station) {
      P22.Radiola.Utils.event('station:' + station.id);
      if (station.old_shoutcast && ! this.supportsOldShoutcast) {
        // For some goddamn reason Safari decides that the tab is open as a
        // frame and completely breaks it if the stream is coming from a
        // non-HTTP/1.1 server (i.e. old_shoutcast) So we default to HLS
        // immediately if it's supported natively (which it should be) and not
        // even allow the other kind of request to happen, because that will
        // break the page entirely.
        // Update[20190619]: This appears to have been fixed, but in a
        // workaround kind of way, wherein Safari throws "Failed to load
        // resource: Cancelled load from '[...]' because it is using HTTP/0.9."
        // This is sort of better because it prevents failure but nonetheless
        // we prefer an HLS stream preemptively.
        if ('hls' in station) {
          this.mode = PlayingMode.HLS;
          this.el.src = station.hls;
          this.el.play();
          return;
        } else {
          // Hopefully this line should not be reached (station._incompatible)
          // but in any case let's not have everything go to shit either.
          throw new Error('Cannot play station in Safari');
        }
      }

      var url = station.stream_mp3;
      // Prevent caching by adding a query string. This works around a Firefox
      // oddity where it occasionally plays a weird garbled stream consisting of
      // both cached blocks and fresh fragments, resulting in some of the
      // weirdest musical whiplash.
      // TODO: perhaps should detect if query string is already present, but
      // it tends not to be.
      url += '?nonce=' + Math.random();
      this.el.src = url;
      this.mode = PlayingMode.MP3;

      // Q: why is this timeout here? -pn 20190619
      window.setTimeout(function() {
        this.playing = true;

        // This was once a fix for the fact that not every browser returns
        // a promise, but that appears to have been fixed since?
        this.el.play().then(function() { /* noop */ }, function(error) {
          // AbortError occurs when a pending play() gets interrupted by
          // pause(). It happens when buffering one station and suddenly
          // switching to another, but this is handled elsewhere and should
          // just be swallowed here.
          if (error.name === 'AbortError') {
            return true;
          }

          // NotSupportedError occurs most often when trying to play a stream
          // that cannot be interpreted by the browser's media stack, such as
          // old_shoutcast in Safari. We might be able to fall back to HLS in
          // such cases, sometimes.
          if (error.name === 'NotSupportedError') {
            if (('hls' in station) && this.supportsNativeHLS) {
              // let's try
              this.el.src = station.hls;
              this.el.play();
              return;
            }
            station._incompatible = true;
          }
          events.emit('error', error.name, error);
        }.bind(this));
      }.bind(this), 0);

      return station;
    },
  };

  PlayManager.el.addEventListener('playing', function() {
    events.emit('playing');
  });

  PlayManager.el.addEventListener('stalled', function() {
    events.emit('stalled');
  });

  PlayManager.supportsOldShoutcast = ! P22.Radiola.Utils.browser.safari;
  PlayManager.supportsNativeHLS =
      PlayManager.el.canPlayType('application/x-mpegURL') !== '';


  window.P22.Radiola.PlayManager = PlayManager;

})()
// vim: set ts=2 sts=2 et sw=2:
