'use strict';

const fs = require('fs')

const Hapi = require('hapi')
const L = require('modulog').bound('radiola')

let stations = require('./stations.json')
let _disabledStations = [ ]
{
  // filter disabled stations
  let remove = [ ]
  for (let i = 0; i < stations.length; i++) {
    let station = stations[i]
    if (station.disabled) { remove.push(i) }
  }
  // reverse iteration to not affect later indexes
  for (let i = remove.length - 1; i >= 0; i--) {
    _disabledStations = _disabledStations.concat(
      stations.splice(remove[i], 1))
  }
}

const S = new Hapi.Server()
S.connection({ port: 8080 })

S.app.stations = stations
S.app.disabledStations = stations

S.decorate('reply', 'event', function(stream) {
  return this.response(stream)
    .code(200)
    .type('text/event-stream')
    .header('Cache-Control', 'no-cache')
    .header('Content-Encoding', 'identity')
    .header('Transfer-Encoding', 'identity')
})

S.register(require('inert'))
.then(() => S.register(require('./src/discover')))
.then(() => S.register(require('./src/routes')))
.then(() => S.start())
.then(() => {
  L.info('Listening on: %s', S.info.uri)
})
.catch(e => {
  L.error('Encountered an error while bootstrapping: ', e)
  process.exit(1)
})
