'use strict';

const fs = require('fs')

const Hapi = require('hapi')
const L = require('modulog').bound('radiola')

let stations = require('./stations.json')
// fs.watch('./stations.json', (e, name) => {
//   fs.readFile('./stations.json', 'utf-8', (e, data) => {
//     if (e) throw e
//     stations = JSON.parse(data)
//   })
// })

const S = new Hapi.Server()
S.connection({ port: 8080 })

S.app.stations = stations

S.decorate('reply', 'event', function(stream) {
  return this.response(stream)
    .code(200)
    .type('text/event-stream')
    .header('Cache-Control', 'no-cache')
    .header('Content-Encoding', 'identity')
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
