/*
 * P22 Radiola
 *
 * @version 1.1.0 (Simfonija)
 * @author paulsnar <paulsnar@paulsnar.lv>
 * @license © 2016 paulsnar. All Rights Reserved.
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
          var d = line.split(':')[1]
          var d2 = { }
          var parts = d.split(',')
          for (var j = 0; j < parts.length; j++) {
            var pair = parts[j].split('=')
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
        extinf: extinf,
      })
    }

    this._lastProcessedChunk = unfetchedChunks[unfetchedChunks.length - 1]
    this._emptyFetches = 0
    this.finished = false

    var mimetype = null
    if (canMSEType(MIMETYPE_AACAUDIO)) {
      mimetype = MIMETYPE_AACAUDIO
    } else if (canMSEType(MIMETYPE_MP4AUDIO + '; codecs="' + codecs + '"')) {
      mimetype = MIMETYPE_MP4AUDIO + '; codecs="' + codecs + '"'
    } else {
      throw new Error('Cannot find audio type that can be used with MSE')
    }

    this._mediaSource = new MediaSource()
    this._sourceBuffer = null
    this._mediaSourceOpenPromise = new Promise(function(res) {
      self._mediaSource.addEventListener('sourceopen', function a() {
        self._mediaSource.removeEventListener('sourceopen', a)
        self._sourceBuffer = self._mediaSource.addSourceBuffer(mimetype)
        res(true)
      })
    })
    this.src = URL.createObjectURL(this._mediaSource)

    Promise.all(
      unfetchedChunks.map(function(c) { return self._chunkPipeline(c) }))

    this._fetchChunksInterval = setInterval(function() {
      self._fetchNewChunkList()
      .then(function(chunks) {
        return chunks.map(function(c) { return self._chunkPipeline(c) })
      })
    }, Math.floor(m3u.targetDuration * 0.47 * 1000))

  }

  try {
    HLSPlaylist.supportsHLS =
      canMSEType(MIMETYPE_AACAUDIO) || canMSEType(MIMETYPE_MP4AUDIO)
  } catch (e) {
    // MediaSource not available
    HLSPlaylist.supportsHLS = false
  }

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
            streamUrl = m3u.chunklists[i]
            streaminf = m3u.streaminfs[i]
          }
        }
        if (!U.isAbsoluteUrl(streamUrl)) {
          streamUrl = U.makeAbsoluteUrl(streamlistUrl, streamUrl)
        }

        return fetch(streamUrl)
          .then(function(r) { return r.text() })
          .then(function(r) { return parseM3U(r) })
          .then(function(m3u) {
            return new HLSPlaylist(streamUrl, m3u, streaminf.CODECS)
          })
      })
  }

  HLSPlaylist.prototype.destroy = function() {
    clearInterval(this._fetchChunksInterval)
  }

  HLSPlaylist.prototype._chunkPipeline = function(chunk) {
    var self = this
    // console.log('[HLS.chunkPipeline] Processing: %s', chunk.chunkUrl)
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

    return fetch(this._selfUrl)
    .then(function(r) { return r.text() })
    .then(function(r) { return parseM3U(r) })
    .then(function(m3u) {
      var newChunks = [ ], seenLastChunk = false
      for (var i = 0; i < m3u.chunks.length; i++) {
        var chunk = m3u.chunks[i]
        var url = U.isAbsoluteUrl(chunk) ? chunk : self._baseUrl + chunk

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

  window.P22.Radiola.HLS = { HLSPlaylist: HLSPlaylist }
})()
// vim: set ts=2 sts=2 et sw=2:
