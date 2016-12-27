/*
 * P22 Radiola
 *
 * @version 1.1.0 (Simfonija)
 * @author paulsnar <paulsnar@paulsnar.lv>
 * @license © 2016 paulsnar. All Rights Reserved.
 */
(function() {
  'use strict';

  var SF = P22.Radiola.SongFinder

  function PlayManager() {
    this.el = document.createElement('audio')
    document.body.appendChild(this.el)
    this.el.style.display = 'none'
    this.el.autoplay = false
    this.el.preload = 'none'
    this.el.volume = 1.0

    this.stations = null

    this.playing = false
    this.lastStation = null

    this._notBuffering = false
    this._currentSong = null
    this._currentStation = null

    this.renewSongInterval = null
    this.onSongRenewal = null

    this.subscribed = false

    this.onPlaying = null

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

    if (this.subscribed) {
      SF.unsubscribe(this.lastStation)
      this.subscribed = false
    }

    this._renderTitle()
  }


  PlayManager.prototype.switchStation = function(id) {
    var self = this

    if (this.playing) {
      this.stop()
    }

    if (!id in this.stations) {
      return false
    }

    var station = this.stations[id]
    this.lastStation = id

    this.el.src = station.stream.url

    window.setTimeout(function() {
      self.playing = true
      self._notBuffering = false
      self.el.play()
    }, 0)

    self._renderTitle()

    var self = this
    SF.canFindSong(id)
    .then(function(canFindSong) {
      if (canFindSong) {
        return SF.canSubscribe(id)
        .then(function(canSubscribe) {
          if (canSubscribe) {
            SF.subscribe(id)
            SF.eventbus.addListener('song.' + id, function(song) {
              self.emit('song_renewed', song, station)
            })
            self.subscribed = true
          } else {
            var _renewSong = function() {
              SF.findSong(id)
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

    return station
  }

  window.P22.Radiola.PlayManager = new PlayManager()

})()
// vim: set ts=2 sts=2 et sw=2:
