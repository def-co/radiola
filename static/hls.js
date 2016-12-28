/*
 * P22 Radiola
 *
 * @version 1.1.0 (Simfonija)
 * @author paulsnar <paulsnar@paulsnar.lv>
 * @license © 2016 paulsnar. All Rights Reserved.
 */
(function() {
  'use strict';

  function stripQuotes(str) {
    if (str.indexOf('"') === 0) {
      str = str.substring(1)
      str = str.substring(0, str.length - 1)
    }
    return str
  }

  function parseM3U(data) {
    var lines = data.split('\n')
    var isExtM3U = false
    var type = null, struct = { }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i]
      if (line.indexOf('#') !== -1) {
        if (line.indexOf('EXTM3U') !== -1) {
          isExtM3U = true
          continue
        } else if (line.indexOf('EXT-X-VERSION:') !== -1) {
          var v = line.split(':')
          if (v[1].trim() !== '3') {
            throw new Error('Can only parse EXTM3Us of version 3')
          } else {
            continue
          }
        } else if (line.indexOf('EXT-X-STREAM-INF:') !== -1) {
          type = 'chunk_pointers'
          var d = line.split(':')[1]
          var d2 = { }
          var parts = d.split(',')
          for (var j = 0; j < parts.length; j++) {
            var pair = parts[j].split('=')
            d2[pair[0]] = stripQuotes(pair[1])
          }
          struct.streaminfs = struct.streaminfs || [ ]
          struct.streaminfs.push(d2)
          continue
        } else if (line.indexOf('EXT-X-MEDIA-SEQUENCE:') !== -1) {
          type = 'chunklist'
          var d = line.split(':')
          struct.mediaSequence = parseInt(d[1], 10)
          if (isNaN(struct.mediaSequence)) {
              struct.mediaSequence = d[1]
          }
          continue
        } else if (line.indexOf('EXT-X-TARGETDURATION:') !== -1) {
          var d = line.split(':')
          struct.targetDuration = parseInt(d[1], 10)
          continue
        } else if (line.indexOf('EXTINF:') !== -1) {
          struct.extinfs = struct.extinfs || [ ]
          var d = line.split(':')
          d[1] = d[1].split(',')
          struct.extinfs.push(d[1])
          continue
        } else if (line.indexOf('EXT-X-KEY:') !== -1) {
          var d = line.split(':')[1]
          var d2 = { }
          var parts = d.split(',')
          for (var j = 0; j < parts.length; j++) {
            var pair = parts[j].split('=')
            d2[pair[0]] = stripQuotes(pair[1])
          }
          struct.encryption = d2
          continue
        }
      } else {
        if (line.trim() === '') { continue }
        switch (type) {
          case 'chunk_pointers':
            struct.chunklists = struct.chunklists || [ ]
            struct.chunklists.push(line)
            continue

          case 'chunklist':
            struct.chunks = struct.chunks || [ ]
            struct.chunks.push(line)
            continue
        }
      }
    }

    if (struct.chunklists && struct.streaminfs &&
        struct.chunklists.length !== struct.streaminfs.length) {
      throw new Error('Malformed EXTM3U: Stream and streaminf count mismatch')
    }
    if (struct.chunklists && !struct.streaminfs) {
      throw new Error('Malformed EXTM3U: No streaminfs but streams present')
    }

    if (struct.chunks && struct.extinfs &&
        struct.chunks.length !== struct.extinfs.length) {
      throw new Error('Malformed EXTM3U: Chunk and extinf count mismatch')
    }
    if (struct.chunks && !struct.extinfs) {
      throw new Error('Malformed EXTM3U: No extinfs but chunks present')
    }

    if (!struct.encryption) { struct.encryption = null }

    struct.type = type

    return Promise.resolve(struct)
  }

  function isAbsoluteUrl(url) {
    return /^(?:\w{2,10}:)?(\/\/).*/i.test(url)
  }
  function makeAbsoluteUrl(base, url) {
    // makes an absolute url out of a base url (with filename) and a relative one
    var a = document.createElement('a')
    a.href = base
    a.search = ''
    var parts = url.split('?')
    if (parts[0].substring(0, 1) === '/') {
      a.pathname = parts[0]
    } else {
      a.pathname += '/../' + parts[0]
    }
    if (parts[1]) {
      a.search = '?' + parts[1]
    }
    return a.href
  }

  var _adoptedPlaylist = null,
      _intervals = [ ]

  var HLSManager = {
    adoptPlaylist: function(playlist) {
      return fetch(playlist)
      .then(function(r) { return r.text() })
      .then(function(r) { return parseM3U(r) })
      .then(function(m3u) { // chunk pointers (hopefully)
        if (m3u.type === 'chunk_pointers') {
          var chosenStream = null, s = null
          if (m3u.chunklists.length === 1) {
            chosenStream = m3u.chunklists[0]
            s = m3u.streaminfs[0]
          } else {
            var chosenBandwidth = parseInt(m3u.streaminfs[0].BANDWIDTH, 10)
            for (var i = 0; i < m3u.streaminfs.length; i++) {
              s = m3u.streaminfs[i]
              var b = parseInt(s.BANDWIDTH, 10)
              if (b > chosenBandwidth) {
                break
              }
            }
            chosenStream = m3u.chunklists[i]
          }
          if (!isAbsoluteUrl(chosenStream)) {
            chosenStream = makeAbsoluteUrl(playlist, chosenStream)
          }
          return Promise.all([
            Promise.resolve(chosenStream),
            Promise.resolve(s),
            fetch(chosenStream)
              .then(function(r) { return r.text() })
              .then(function(r) { return parseM3U(r) }),
          ])
        } else {
          throw new Error('Invalid playlist; please pass a source list')
        }
      })
      .then(function(pair) { // chunklist
        var playlistUrl = pair[0], chosenStreaminf = pair[1], m3u = pair[2]
        var p = new HLSPlaylist(
          playlistUrl,
          chosenStreaminf,
          m3u
        )
        _adoptedPlaylist = p
        return p
      })
    },
    schedule: function(func, timeout) {
      var i = _intervals.push(window.setTimeout(function() {
        _intervals[i] = null
        func()
      }, timeout)) - 1
    },
    schedulePeriodic: function(func, timeout) {
      var i = _intervals.push(window.setInterval(func, timeout))
    },
    stop: function() {
      for (var i = 0; i < _intervals.length; i++) {
        if (_intervals[i] !== null) {
          console.log('[HLS.TimeManager] clearing interval %d', i)
          window.clearTimeout(_intervals[i])
        }
      }
      return true
    },
  }

  var MIMETYPE_AACAUDIO = 'audio/aac', MIMETYPE_MP4AUDIO = 'audio/mp4'
  function canMSEType(type) { return MediaSource.isTypeSupported(type) }

  HLSManager.supportsHLS =
    canMSEType(MIMETYPE_AACAUDIO) || canMSEType(MIMETYPE_MP4AUDIO)

  function HLSPlaylist(playlistUrl, chosenStreaminf, m3u) {
    var self = this

    this._selfUrl = playlistUrl
    // this._sequence = null
    this._baseUrl = makeAbsoluteUrl(playlistUrl, '')
    this._streaminf = chosenStreaminf

    // if (typeof m3u.mediaSequence !== 'number') {
    //   throw new TypeError('Invalid sequence identifier: ' + this._sequence)
    // }
    // this._sequence = m3u.mediaSequence

    var unfetchedChunks = [ ]
    for (var i = 0; i < m3u.chunks.length; i++) {
      var chunk = m3u.chunks[i], extinf = m3u.extinfs[i]
      unfetchedChunks.push({
        chunkUrl: isAbsoluteUrl(chunk) ? chunk : this._baseUrl + chunk,
        extinf: extinf,
      })
    }

    this._lastProcessedChunk = unfetchedChunks[unfetchedChunks.length - 1]
    this._emptyFetches = 0
    this.finished = false

    if (!('MediaSource' in window)) {
      throw new Error('MediaSource not available')
    }

    var c = chosenStreaminf.CODECS
    if (canMSEType(MIMETYPE_AACAUDIO)) {
      this._mime = MIMETYPE_AACAUDIO
    } else if (canMSEType(MIMETYPE_MP4AUDIO + '; codecs="' + c + '"')) {
      this._mime = MIMETYPE_MP4AUDIO + '; codecs="' + c + '"'
    } else {
      throw new Error('Cannot find audio type that can be used with MSE')
    }

    this._mediaSource = new MediaSource()
    this._mediaSourceOpen = false
    this._mediaSourceOpenPromise = new Promise(function(res) {
      self._mediaSource.addEventListener('sourceopen', function a() {
        self._mediaSource.removeEventListener('sourceopen', a)
        res()
      })
    }).then(function() {
      self._mediaSourceOpen = true
      self._sourceBuffer = self._mediaSource.addSourceBuffer(self._mime)
    })
    this._sourceBuffer = null

    this._initialFetchPromise = Promise.all(
      unfetchedChunks.map(function(c) { return self._chunkPipeline(c) })
    )

    HLSManager.schedulePeriodic(function() {
      self._fetchNewChunkList()
      .then(function(chunks) {
        return chunks.map(function(c) { return self._chunkPipeline(c) })
      })
    }, Math.floor(m3u.targetDuration * 0.47 * 1000))

    this.src = URL.createObjectURL(this._mediaSource)
  }

  HLSPlaylist.prototype._chunkPipeline = function(chunk) {
    var self = this
    console.log('[HLS.chunkPipeline] Processing: %s', chunk.chunkUrl)
    this._lastProcessedChunk = chunk

    return this._fetchChunk(chunk.chunkUrl)
      .then(function(buf) { return self._appendChunk(buf) })
  }

  HLSPlaylist.prototype._fetchChunk = function(chunk) {
    var self = this

    return fetch(chunk)
    .then(function(r) { return r.arrayBuffer() })
  }

  HLSPlaylist.prototype._appendChunk = function(buffer) {
    var self = this

    var p = Promise.resolve()
    if (!this._mediaSourceOpen) {
      p = this._mediaSourceOpenPromise
    }

    return p.then(function() {
      return new Promise(function(res) {
        self._sourceBuffer.addEventListener('updateend', function a() {
          self._sourceBuffer.removeEventListener('updateend', a)
          res()
        })
        self._sourceBuffer.appendBuffer(buffer)
      })
    })
  }

  HLSPlaylist.prototype._fetchNewChunkList = function() {
    var self = this

    return fetch(this._selfUrl)
    .then(function(r) { return r.text() })
    .then(function(r) { return parseM3U(r) })
    .then(function(m3u) {
      var newChunks = [ ], seenLastChunk = false
      for (var i = 0; i < m3u.chunks.length; i++) {
        var chunk = m3u.chunks[i]
        var url = isAbsoluteUrl(chunk) ? chunk : self._baseUrl + chunk

        if (url === self._lastProcessedChunk.chunkUrl) {
          seenLastChunk = true
          continue
        } else if (!seenLastChunk) {
          continue
        } else {
          newChunks.push({ chunkUrl: url, extinf: m3u.extinfs[i] })
        }
      }

      if (newChunks.length === 0) {
        self._emptyFetches += 1
      } else {
        self._emptyFetches = 0
      }

      return newChunks
    })
  }

  // IV is either given or it is a 32 bit unsigned integer equal to sequence
  // number
  // Key is given

  // Example: STAR FM http://starfm.live.advailo.com/audio/live/playlist.m3u8
  // Example: LR1 http://muste.radio.org.lv/shoutcast/mp4:lr1a.stream/playlist.m3u8

  window.P22.Radiola.HLSManager = HLSManager
})()
// vim: set ts=2 sts=2 et sw=2:
