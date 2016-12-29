'use strict';

const EventEmitter = require('events'),
      Stream = require('stream')

const _ = require('lodash')

const Delegates = require('./delegates')

class DiscoveryManager extends EventEmitter {
  constructor() {
    super()

    this.delegates = new Map()
  }

  canFindSong(station) {
    var d = Delegates.findAppointedDelegate(station)
    if (!d) { return false }
    return _.includes(Delegates[d].prototype.canDiscover, 'song')
  }
  canFindProgram(station) {
    var d = Delegates.findAppointedDelegate(station)
    if (!d) { return false }
    return _.includes(Delegates[d].prototype.canDiscover, 'program')
  }
  canDiscover(station) {
    return this.canFindSong(station) || this.canFindProgram(station)
  }

  discoverOnce(station) {
    return this.getDelegate(station).discoverOnce(station)
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

  createStream(station, filter = [ ]) {
    let stream = new Stream.PassThrough()

    if (filter.length === 0) { filter = ['song', 'program'] }

    let delegate = this.getDelegate(station)
    delegate.subscribeStream(stream, station, filter)

    return stream
  }
}

module.exports = DiscoveryManager
