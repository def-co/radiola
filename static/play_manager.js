/*
 * P22 Radiola
 *
 * @version 1.1.0 (Simfonija)
 * @author paulsnar <paulsnar@paulsnar.lv>
 * @license © 2016 paulsnar. All Rights Reserved.
 */
(function() {
  'use strict';

  var SF = P22.Radiola.SongFinder, HLS = P22.Radiola.HLS

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
      self._renderTitle()
    })

    this.addListener('song_renewed', function(song, currentStation) {
      // console.log('[PlayManager] Changing song on %s: %O',
      //   currentStation.name, song)
      self._currentSong = song
      self._currentStation = currentStation
      self._renderTitle()
    })
  }
  PlayManager.prototype = Object.create(EventEmitter.prototype)
  PlayManager.prototype.constructor = PlayManager

  PlayManager.prototype.SUPPORTS_OLD_SHOUTCAST =
    !(window.safari || (window.chrome && window.chrome.runtime))
  PlayManager.prototype.SUPPORTS_HLS = HLS.supportsHLS

  PlayManager.prototype._renderTitle = function() {
    let title_el = document.getElementsByTagName('title')[0]

    let title = ''
    if (this.playing && this._notBuffering) {
      title += '▶ '
    } else if (this.playing && !this._notBuffering) {
      title += '… '
    }

    if (this._currentSong !== null) {
      title += this._currentSong.artist
      title += ' - '
      title += this._currentSong.title
      title += ' :: '
    }

    if (this._currentStation !== null) {
      title += this._currentStation.name
      title += ' :: '
    }

    title += 'P22 Radiola'

    title_el.textContent = title
  }

  PlayManager.prototype.init = function(json) {
    this.stations = { }
    json.stations.forEach(function(station) {
      this.stations[station.id] = station
    }.bind(this))

    return true
  }

  PlayManager.prototype.stop = function() {
    this.el.pause()
    this.el.src = ''
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

    if (this.subscribed) {
      SF.unsubscribe(this.lastStation)
      this.subscribed = false
    }

    this._renderTitle()
  }


  PlayManager.prototype.switchStation = function(id) {
    var self = this

    if (this.playing) { this.stop() }

    if (!id in this.stations) { return false }

    var station = this.stations[id]
    this.lastStation = id

    SF.canDiscover(id)
    .then(function(canFindSong) {
      if (canFindSong) {
        return SF.canSubscribe(id)
        .then(function(canSubscribe) {
          if (canSubscribe) {
            SF.subscribe(id)
            self.subscribed = true
          } else {
            var _renewSong = function() {
              SF.discover(id)
              .then(function(data) {
                self.emit('song_renewed', data, station)
              })
            }
            self.renewSongInterval = window.setInterval(_renewSong, 15000)
            _renewSong()
          }
        })
      } else {
        self.renewSongInterval = null
      }
    })
    this._renderTitle()

    var _useHLS = function() {
      HLS.HLSPlaylist.fromStreamlist(station.hls)
        .then(function(p) {
          self._hlsPlaylist = p
          self.el.src = p.src
          self.el.play()
        })
      return station
    }

    if (window.safari && station.old_shoutcast) {
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
        self.emit('playingError', e.name, e)
        console.error('[PlayManager] Playing failed: (%s)', e.name, e)
      })
    }, 0)

    return station
  }

  window.P22.Radiola.PlayManager = new PlayManager()

})()
// vim: set ts=2 sts=2 et sw=2:
