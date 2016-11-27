(function() {
  'use strict';

  var SongFinder = {
    DETECTABLES: [
      'swh', 'swh_gold',
      'swh_rock',
      'pieci_koncerti', 'pieci'],
    canFindSong: function(station) {
      return SongFinder.DETECTABLES.indexOf(station.id) !== -1
    },

    __findSwh: function(p) {
      fetch('/discover_swh/' + p + '.json')
      .then(function(r) { return r.json() })
      .then(function(resp) {
        var selection = { }
        var _$ = document.createElement('div')
        function unescape(e) {
          _$.innerHTML = e
          return _$.textContent
        }
        selection.artist = unescape(resp[0].artist)
        selection.title = unescape(resp[0].title)

        return selection
      })
    },

    __findSwhRock: function() {
      fetch('/discover_swh_rock.json')
      .then(function(r) { return r.json() })
      .then(function(resp) {
        var selection = resp.split('-')
        return { artist: selection[0], title: selection[1] }
      })
    },

    __findPieci: function(lookFor) {
      fetch('/discover_pieci.json')
      .then(function(r) { return r.json() })
      .then(function(resp) {
        var sel = null
        resp.forEach(function(item) {
          if (item.id === lookFor) {
            sel = item
          }
        })

        if (sel === null || !sel.playlist || sel.playlist.length === 0)
          return null

        return {
          artist: sel.playlist[0].artist,
          title: sel.playlist[0].title
        }
      })
    },

    findSong: function(station) {
      switch (station.id) {
        case 'swh': return SongFinder.__findSwh('swh_online')
        case 'swh_gold': return SongFinder.__findSwh('gold_online')
        case 'swh_rock': return SongFinder.__findSwhRock()

        case 'pieci_koncerti': return SongFinder.__findPieci('1')
        case 'pieci_atklajumi': return SongFinder.__findPieci('5')
        case 'pieci_latviesi': return SongFinder.__findPieci('7')
        case 'pieci_riti': return SongFinder.__findPieci('11')
        case 'pieci_hiti': return SongFinder.__findPieci('17')
        case 'pieci': return SongFinder.__findPieci('19')
        case 'pieci_100': return SongFinder.__findPieci('26')

        default: return null
      }
    }
  }

  window.P22.Radiola.SongFinder = SongFinder


})()
