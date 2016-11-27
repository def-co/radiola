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
  }

  PlayManager.prototype.init = function(json) {
    this.stations = { }
    json.stations.forEach(function(station) {
      this.stations[station.id] = station
    }.bind(this))

    return true
  }

  PlayManager.prototype.switchStation = function(id) {
    if (this.playing) {
      this.el.pause()
      window.cancelInterval(this.renewSongInterval)
      if (this.onSongRenewal !== null) this.onSongRenewal(null)
      this.playing = false
    }

    if (!id in this.stations) {
      return false
    }

    var station = this.stations[id]

    this.el.src = station.stream.url

    this.playing = true
    this.el.play()

    document.querySelector('title')
      .textContent = '▶ ' + station.name + ' :: radiola.p22.co'

    if (P22.Radiola.SongFinder.canFindSong(station)) {
      var self = this
      var _renewSong = function() {
        if (self.onSongRenewal === null) return

        P22.Radiola.SongFinder.findSong(station)
        .then(function(data) {
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
