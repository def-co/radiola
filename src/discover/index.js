'use strict';

const L = require('modulog').bound('discover')

const DiscoveryManager = require('./manager')

exports.register = (S, opts, next) => {
  let D = new DiscoveryManager()

  S.expose('discovery_manager', D)

  S.route({
    method: 'GET',
    path: '/discover/{station}',
    handler: (request, reply) => {
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
    path: '/discover/songs/{station}',
    handler: (request, reply) => {
      if (D.canFindSong(request.params.station)) {
        let stream = D.createSongStream(request.params.station)

        request.once('disconnect', () => {
          stream.emit('close')
        })

        reply.event(stream)
      } else {
        reply.event([
          'event: stream_error',
          'data: "Invalid station."',
          '',
          '',
        ].join('\n'))
          .code(400)
          .header('Connection', 'close')
      }
    }
  })

  S.route({
    method: 'GET',
    path: '/discover/programs/{station}',
    handler: (request, reply) => {
      if (D.canFindProgram(request.params.station)) {
        let stream = D.createProgramStream(request.params.station)

        request.once('disconnect', () => {
          stream.emit('close')
        })

        reply.event(stream)
      } else {
        reply.event([
          'event: stream_error',
          'data: "Invalid station."',
          '',
          '',
        ].join('\n'))
          .code(400)
          .header('Connection', 'close')
      }
    }
  })

  S.route({
    method: 'GET',
    path: '/discover/hose/{station}',
    handler: (request, reply) => {
      if (D.canDiscover(request.params.station)) {
        let stream = D.createHoseStream(request.params.station)

        request.once('disconnect', () => {
          stream.emit('close')
        })

        reply.event(stream)
      } else {
        reply.event([
          'event: stream_error',
          'data: "Invalid station."',
          '',
          '',
        ].join('\n'))
          .code(400)
          .header('Connection', 'close')
      }
    }
  })

  return next()
}

exports.register.attributes = {
  name: 'radiola.discover',
  version: '1.1.0',
}
