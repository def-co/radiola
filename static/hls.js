/*
 * P22 Radiola
 *
 * @version 1.1.0 (Simfonija)
 * @author paulsnar <paulsnar@paulsnar.lv>
 * @license © 2016-2017 paulsnar. All Rights Reserved.
 */
(function() {
  'use strict';

  var U = P22.Radiola.Utils

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
            d2[pair[0]] = U.stripQuotes(pair[1])
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
          var pieces = line.split(':')
          pieces.shift()
          var d = pieces.join(':')
          var d2 = { }
          var parts = d.split(',')
          for (var j = 0; j < parts.length; j++) {
            var pieces = parts[j].split('=')
            var pair = [ pieces.shift(), pieces.join('=') ]
            d2[pair[0]] = U.stripQuotes(pair[1])
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

  var MIMETYPE_AACAUDIO = 'audio/aac', MIMETYPE_MP4AUDIO = 'audio/mp4'
  function canMSEType(type) { return MediaSource.isTypeSupported(type) }

  function HLSPlaylist(playlistUrl, m3u, codecs) {
    var self = this

    if (!('MediaSource' in window)) {
      throw new Error('MediaSource not available')
    }

    this._selfUrl = playlistUrl
    this._baseUrl = U.makeAbsoluteUrl(playlistUrl, '')

    var unfetchedChunks = [ ]
    for (var i = 0; i < m3u.chunks.length; i++) {
      var chunk = m3u.chunks[i], extinf = m3u.extinfs[i]
      unfetchedChunks.push({
        chunkUrl: U.isAbsoluteUrl(chunk) ? chunk : this._baseUrl + chunk,
        extinf: {
          originalExtinf: extinf,
          sequence: m3u.mediaSequence + i,
        },
      })
    }

    // if (m3u.encryption) {
    //   this._encryption = this._initEncryption(m3u.encryption)
    // }

    this._lastProcessedChunk = unfetchedChunks[unfetchedChunks.length - 1]
    this._emptyFetches = 0
    this.finished = false

    this.mimetype = null
    if (canMSEType(MIMETYPE_AACAUDIO)) {
      this.mimetype = MIMETYPE_AACAUDIO
    } else if (canMSEType(MIMETYPE_MP4AUDIO + '; codecs="' + codecs + '"')) {
      this.mimetype = MIMETYPE_MP4AUDIO + '; codecs="' + codecs + '"'
    } else {
      throw new Error('Cannot find audio type that can be used with MSE')
    }

    this._mediaSource = new MediaSource()
    this._sourceBuffer = null
    this._mediaSourceOpenPromise = new Promise(function(res) {
      self._mediaSource.addEventListener('sourceopen', function a() {
        self._mediaSource.removeEventListener('sourceopen', a)
        self._sourceBuffer = self._mediaSource.addSourceBuffer(self.mimetype)
        res(true)
      })
    })
    this.src = URL.createObjectURL(this._mediaSource)

    this._chunkPipeline(unfetchedChunks)

    this._fetchChunksInterval = setInterval(function() {
      self._fetchNewChunkList()
      .then(function(chunks) {
        if (chunks.length > 0) {
          return self._chunkPipeline(chunks)
        }
      })
    }, Math.floor(m3u.targetDuration * 0.47 * 1000))

  }

  HLSPlaylist.supportsHLS = fetch('http://nottps.p22.co/204.php')
  .then(function(q) {
    // if this succeeds then unsecure requests are not prohibited
    // which is unlikely but whatever
    return canMSEType(MIMETYPE_AACAUDIO) || canMSEType(MIMETYPE_MP4AUDIO)
  }, function(e) {
    // unsecure requests are not allowed, which most likely breaks HLS since
    // too many stations do it over HTTP instead of HTTPS :/
    return false
  })

  HLSPlaylist.fromStreamlist = function(streamlistUrl) {
    return fetch(streamlistUrl)
      .then(function(r) { return r.text() })
      .then(function(r) { return parseM3U(r) })
      .then(function(m3u) {
        if (m3u.type !== 'chunk_pointers') {
          throw new Error('Invalid playlist; please pass a source list')
        }

        var streamUrl = null, streaminf = null

        var highestBandwidth = 0
        for (var i = 0; i < m3u.streaminfs.length; i++) {
          if (parseInt(m3u.streaminfs[i].BANDWIDTH, 10) > highestBandwidth) {
            highestBandwidth = parseInt(m3u.streaminfs[i].BANDWIDTH, 10)
            streamUrl = m3u.chunklists[i]
            streaminf = m3u.streaminfs[i]
          }
        }
        if (!U.isAbsoluteUrl(streamUrl)) {
          streamUrl = U.makeAbsoluteUrl(streamlistUrl, streamUrl)
        }

        return (fetch(streamUrl)
          .then(function(r) { return r.text() })
          .then(function(r) { return parseM3U(r) })
          .then(function(m3u) {
            return new HLSPlaylist(streamUrl, m3u, streaminf.CODECS)
          }))
      })
  }

  HLSPlaylist.prototype.destroy = function() {
    clearInterval(this._fetchChunksInterval)
  }

  // HLSPlaylist.prototype._initEncryption = function(encryption) {
  //   if (!('crypto' in window) ||
  //       !('subtle' in window.crypto)) {
  //     throw new Error('Cryptography not supported but required')
  //   }
  //
  //   return fetch(encryption.URI)
  //     .then(function(r) { return r.arrayBuffer() })
  //     .then(function(ab) {
  //       return {
  //         method: encryption.METHOD,
  //         keyArrayBuffer: ab,
  //       }
  //     })
  // }

  HLSPlaylist.prototype._chunkPipeline = function(chunks) {
    var self = this

    if (!Array.isArray(chunks)) {
      return this._chunkPipeline([chunks])
    }

    var _lastPromise = Promise.resolve(null)
    var fetches = chunks.map(function(c) { return self._fetchChunk(c) })
    for (var i = 0; i < chunks.length; i++) {
      self._lastProcessedChunk = chunks[i]
      _lastPromise = _lastPromise.then(function(fetch, chunk) {
        return fetch.then(function(b) {
          // if (self._encryption) {
          //   return self._decryptChunk(b, chunk.extinf.sequence)
          //     .then(function(b) { return self._appendChunk(b) })
          // } else {
            return self._appendChunk(b)
          // }
        })
      }.bind(null, fetches[i], chunks[i]))
    }
    return _lastPromise
  }

  HLSPlaylist.prototype._fetchChunk = function(chunk) {
    return fetch(chunk.chunkUrl).then(function(r) { return r.arrayBuffer() })
  }

  // HLSPlaylist.prototype._decryptChunk = function(buffer, sequence) {
  //   var self = this
  //   var crypto = window.crypto
  //
  //   var algo = {
  //     name: 'AES-CBC',
  //     length: 128,
  //     iv: new Uint32Array([0, 0, 0, sequence]),
  //   }
  //
  //
  //   return this._encryption.then(function(e) {
  //     return crypto.subtle.importKey('raw', e.keyArrayBuffer, algo, true, ['decrypt'])
  //   }).then(function(key) {
  //     return crypto.subtle.decrypt(algo, key, buffer)
  //   })
  // }

  HLSPlaylist.prototype._appendChunk = function(buffer) {
    var self = this

    return this._mediaSourceOpenPromise.then(function() {
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

    return (fetch(this._selfUrl)
    .then(function(r) { return r.text() })
    .then(function(r) { return parseM3U(r) })
    .then(function(m3u) {
      var newChunks = [ ], seenLastChunk = false
      for (var i = 0; i < m3u.chunks.length; i++) {
        var chunk = m3u.chunks[i]
        var url = U.isAbsoluteUrl(chunk) ? chunk : self._baseUrl + chunk
        var extinf = {
          originalExtinf: m3u.extinfs[i],
          sequence: m3u.mediaSequence + i,
        }

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
    }))
  }

  window.P22.Radiola.HLS = {
    HLSPlaylist: HLSPlaylist,
    supportsHLS: HLSPlaylist.supportsHLS,
  }
})()
// vim: set ts=2 sts=2 et sw=2:
