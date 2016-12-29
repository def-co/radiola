'use strict';


const L = require('modulog').bound('discover'),
      _ = require('lodash')

const DiscoveryManager = require('./manager')

exports.register = (S, opts, next) => {
  let D = new DiscoveryManager()

  S.expose('discovery_manager', D)

  const stationExists = (station) => {
    let s = _.find(S.app.stations, (v) => v.id === station)
    return typeof s !== 'undefined'
  }

  S.route({
    method: 'GET',
    path: '/discover/{station}',
    handler: (request, reply) => {
      if (!stationExists(request.params.station)) {
        return reply({
          ok: false,
          error: 'not_found',
          error_text: 'This station does not exist.',
        }).code(404)
      }

      reply({
        ok: true,
        station: request.params.station,
        can_find_song: D.canFindSong(request.params.station),
        can_find_program: D.canFindProgram(request.params.station),
      })
    }
  })

  S.route({
    method: 'GET',
    path: '/discover/now/{station}',
    handler: (request, reply) => {
      if (!stationExists(request.params.station)) {
        reply({
          ok: false,
          error: 'not_found',
          error_text: 'This station does not exist.',
        }).code(404)
      }

      if (D.canDiscover(request.params.station)) {
        D.discoverOnce(request.params.station)
        .then((state) => {
          reply({ ok: true, data: state })
        })
        .catch((e) => {
          L.error('/discover/now/%s:', request.params.station, e)
          reply({
            ok: false,
            error: 'server_error'
          }).code(500)
        })
      } else {
        reply({
          ok: false,
          error: 'cannot_find_song',
          error_text: 'This station does not support song finding.',
        }).code(400)
      }
    }
  })

  S.route({
    method: 'GET',
    path: '/discover/hose/{station}',
    handler: (request, reply) => {
      if (!stationExists(request.params.station)) {
        return reply.event([
          'event: stream_error',
          'data: "Invalid station."',
          '',
          '',
        ].join('\n'))
          .code(404)
          .header('Connection', 'close')
      }

      if (!D.canDiscover(request.params.station)) {
        reply.event([
          'event: stream_error',
          'data: "Invalid station."',
          '',
          '',
        ].join('\n'))
        .code(400)
        .header('Connection', 'close')
      }

      let filter = request.query.filter ? request.query.filter.split(',') : [ ]

      let stream = D.createStream(request.params.station, filter)

      request.once('disconnect', () => {
        stream.emit('close')
      })

      reply.event(stream)
    }
  })

  return next()
}

exports.register.attributes = {
  name: 'radiola.discover',
  version: '1.1.0',
}
