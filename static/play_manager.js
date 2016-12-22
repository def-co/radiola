/*
 * P22 Radiola
 *
 * @version 1.0.20 (Rigonda)
 * @author paulsnar <paulsnar@paulsnar.lv>
 * @license © 2016 paulsnar. All Rights Reserved.
 */
(function() {
  'use strict';

  function PlayManager() {
    this.el = document.createElement('audio')
    document.body.appendChild(this.el)
    this.el.style.display = 'none'
    this.el.autoplay = false
    this.el.preload = 'none'
    this.el.volume = 1.0

    this.stations = null

    this.playing = false

    this.renewSongInterval = null
    this.onSongRenewal = null

    this.onPlaying = null

    var self = this
    this.el.addEventListener('playing', function() {
      if (self.onPlaying !== null) self.onPlaying()
    })
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
    if (this.renewSongInterval !== null) window.clearInterval(this.renewSongInterval)
    if (this.onSongRenewal !== null) this.onSongRenewal(null)
    this.playing = false

    document.querySelector('title').textContent = 'radiola.p22.co'
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

    this.el.src = station.stream.url

    window.setTimeout(function() {
      self.playing = true
      self.el.play()
    }, 0)

    document.querySelector('title')
      .textContent = '▶ ' + station.name + ' :: radiola.p22.co'

    if (P22.Radiola.SongFinder.canFindSong(station)) {
      var self = this
      var _renewSong = function() {
        if (self.onSongRenewal === null) return

        P22.Radiola.SongFinder.findSong(station)
        .then(function(data) {
          document.querySelector('title')
            .textContent = '▶ ' + data.artist + ' - ' + data.title + ' :: ' +
              station.name + ' :: radiola.p22.co'
          self.onSongRenewal(data)
        })
      }
      this.renewSongInterval = window.setInterval(_renewSong, 15000)
      _renewSong()
    } else {
      this.renewSongInterval = null
    }

    return station
  }

  window.P22.Radiola.PlayManager = new PlayManager()

})()
// vim: set ts=2 sts=2 et sw=2:
