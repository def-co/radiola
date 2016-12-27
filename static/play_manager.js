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

    this.renewSongInterval = null
    this.onSongRenewal = null

    this.subscribed = false

    this.onPlaying = null

    var self = this
    this.el.addEventListener('playing', function() {
      self.emit('playing')
    })

    var title_el = document.getElementsByTagName('title')[0]
    this.addListener('song_renewed', function(song, current_station) {
      // console.log('[PlayManager] Changing song on %s: %O',
      //   current_station.name, song)
      title_el.textContent = [
        '▶',
        song.artist,
        '-',
        song.title,
        '::',
        current_station.name,
        '::',
        'radiola.p22.co',
      ].join(' ')
    })
  }
  PlayManager.prototype = Object.create(EventEmitter.prototype)
  PlayManager.prototype.constructor = PlayManager

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

    if (this.renewSongInterval !== null) {
      window.clearInterval(this.renewSongInterval)
    }
    this.playing = false

    if (this.subscribed) {
      SF.unsubscribe(this.lastStation)
      this.subscribed = false
    }

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
    this.lastStation = id

    this.el.src = station.stream.url

    window.setTimeout(function() {
      self.playing = true
      self.el.play()
    }, 0)

    document.querySelector('title')
      .textContent = '▶ ' + station.name + ' :: radiola.p22.co'

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
