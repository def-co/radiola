'use strict';

const EventEmitter = require('events'),
      Stream = require('stream')

const Delegates = require('./delegates')

class DiscoveryManager extends EventEmitter {
  constructor() {
    super()

    this.delegates = new Map()
  }

  canFindSong(station) {
    return DiscoveryManager.CAN_FIND_SONG.has(station)
  }

  findSongOnce(station) {
    let appointedDelegate = Delegates.findAppointedDelegate(station),
        delegate = null

    if (this.delegates.has(appointedDelegate)) {
      delegate = this.delegates.get(appointedDelegate)
    } else {
      delegate = new (Delegates[appointedDelegate])()
      this.delegates.set(appointedDelegate, delegate)
    }

    return delegate.findSongOnce(station)
  }

  createSongStream(station) {
    let stream = new Stream.PassThrough()

    let appointedDelegate = Delegates.findAppointedDelegate(station),
        delegate = null

    if (this.delegates.has(appointedDelegate)) {
      delegate = this.delegates.get(appointedDelegate)
    } else {
      delegate = new (Delegates[appointedDelegate])()
      this.delegates.set(appointedDelegate, delegate)
    }

    delegate.attachStream(stream, station)

    return stream
  }
}

DiscoveryManager.CAN_FIND_SONG = new Set([
    'swh', 'swh_gold', 'swh_rock',

    'pieci_koncerti', 'pieci_atklajumi', 'pieci_latviesi', 'pieci_hiti', 'pieci', 'pieci_ziemassvetki',

    'ehr',
  ])

module.exports = DiscoveryManager
