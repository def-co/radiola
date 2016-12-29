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
  canFindProgram(station) {
    return DiscoveryManager.CAN_FIND_PROGRAM.has(station)
  }
  canDiscover(station) {
    return this.canFindSong(station) || this.canFindProgram(station)
  }

  findSongOnce(station) {
    return this.getDelegate(station).findSongOnce(station)
  }
  findProgramOnce(station) {
    return this.getDelegate(station).findProgramOnce(station)
  }

  getDelegate(station) {
    let appointedDelegate = Delegates.findAppointedDelegate(station)

    if (this.delegates.has(appointedDelegate)) {
      return this.delegates.get(appointedDelegate)
    } else {
      let delegate = new (Delegates[appointedDelegate])()
      this.delegates.set(appointedDelegate, delegate)
      return delegate
    }
  }

  createSongStream(station) {
    let stream = new Stream.PassThrough()

    let delegate = this.getDelegate(station)
    delegate.subscribeStream(stream, station, ['songs'])

    return stream
  }

  createProgramStream(station) {
    let stream = new Stream.PassThrough()

    let delegate = this.getDelegate(station)
    delegate.subscribeStream(stream, station, ['programs'])

    return stream
  }

  createHoseStream(station) {
    let stream = new Stream.PassThrough()

    let delegate = this.getDelegate(station)
    delegate.subscribeStream(stream, station, ['songs', 'programs'])

    return stream
  }
}

DiscoveryManager.CAN_FIND_SONG = new Set([
  'swh', 'swh_gold', 'swh_rock',

  'pieci_koncerti', 'pieci_atklajumi', 'pieci_latviesi', 'pieci_hiti', 'pieci', 'pieci_ziemassvetki',

  'ehr',
])

DiscoveryManager.CAN_FIND_PROGRAM = new Set([
  'lr1', 'lr2', 'lr3', 'lr4', 'lr6',
])

module.exports = DiscoveryManager
