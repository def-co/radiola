/*
 * P22 Radiola
 *
 * @version 1.1.0 (Simfonija)
 * @author paulsnar <paulsnar@paulsnar.lv>
 * @license © 2016-2017 paulsnar. All Rights Reserved.
 */
(function() {
  'use strict';

  var HLS = P22.Radiola.HLS, T = P22.Radiola.Telemetry, U = P22.Radiola.Utils

  function PlayManager() {
    this.el = document.createElement('audio')
    document.body.appendChild(this.el)
    this.el.style.display = 'none'
    this.el.autoplay = false
    this.el.preload = 'none'
    this.el.volume = 1.0

    this.el.addEventListener('stalled', function(e) {
      self.emit('stalled')
    })

    this.stations = null

    this.playing = false
    this.lastStation = null

    this._notBuffering = false
    this._currentSong = null
    this._currentStation = null

    this.renewSongInterval = null

    this.subscribed = false

    this._hlsPlaylist = null

    var self = this
    this.el.addEventListener('playing', function() {
      self._notBuffering = true
      self.emit('playing')
      T.station.playing(self.lastStation)
    })
  }
  PlayManager.prototype = Object.create(EventEmitter.prototype)
  PlayManager.prototype.constructor = PlayManager

  PlayManager.prototype.SUPPORTS_OLD_SHOUTCAST = U.browser.firefox
    // TODO: check whether Edge supports ^ old_shoutcast as well
  PlayManager.prototype.SUPPORTS_HLS =
    Promise.all([HLS.supportsHLS, HLS.supportsNativeHLS])
      .then(function(q) { return q[0] || q[1] })

  PlayManager.prototype.init = function(json) {
    this.stations = { }
    json.stations.forEach(function(station) {
      this.stations[station.id] = station
    }.bind(this))

    return true
  }

  PlayManager.prototype.stop = function() {
    this.el.src = ''
    this.el.pause()
    this.emit('stopped')

    this._currentSong = null
    this._currentStation = null

    if (this.renewSongInterval !== null) {
      window.clearInterval(this.renewSongInterval)
    }
    this.playing = false

    if (this._hlsPlaylist) {
      this._hlsPlaylist.destroy()
      this._hlsPlaylist = null
    }

    this.lastStation = null
  }


  PlayManager.prototype.switchStation = function(id) {
    var self = this

    if (!id in this.stations) { return false }

    var station = this.stations[id]
    this.lastStation = id

    var _useHLS = function() {
      HLS.supportsNativeHLS
      .then(function(sup) {
        if (sup) {
          self.el.src = station.hls
          self.el.play()
          return null
        } else {
          return HLS.supportsHLS
        }
      })
      .then(function(sup) {
        if (sup) {
          HLS.HLSPlaylist.fromStreamlist(station.hls)
          .then(function(p) {
            self._hlsPlaylist = p
            self.el.src = p.src
            self.el.play()
          })
        }
      })
      return station
    }

    T.station.start(id)

    if (U.browser.safari && station.old_shoutcast) {
      // For some goddamn reason Safari decides that the tab is open as a frame
      // and completely breaks it if the stream is coming from an non-HTTP/1.1
      // server (i.e. old_shoutcast) So we default to HLS immediately and not
      // even allow the other kind of request to happen, because that will
      // break the page entirely.
      if ('hls' in station) {
        return _useHLS()
      } else {
        throw new Error('Safari saving exception (see stack trace and nearby comment)')
      }
    }

    this.el.src = station.stream_mp3

    window.setTimeout(function() {
      self.playing = true
      self._notBuffering = false
      Promise.resolve(self.el.play()) // Firefox doesn't return a promise
      .catch(function(e) {
        // AbortError occurs when a pending play() gets interrupted by pause()
        // It happens when buffering one station and switching to another, so
        // we just ignore it :)
        if (e.name === 'AbortError') { return true }
        // NotSupportedError occurs most often when trying to play a stream
        // that cannot be interpreted by the browser's media stack
        // (i.e. old_shoutcast for Chrome/Safari). We might be able to fall
        // back to HLS, or we might not. I dunno :)
        if (e.name === 'NotSupportedError' &&
            ('hls' in station) && !self._hlsPlaylist) {
          return _useHLS()
        }
        T.exception(e)
        self.emit('playingError', e.name, e)
        console.error('[PlayManager] Playing failed: (%s)', e.name, e)
      })
    }, 0)

    return station
  }

  window.P22.Radiola.PlayManager = new PlayManager()

})()
// vim: set ts=2 sts=2 et sw=2:
