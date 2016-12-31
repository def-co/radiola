'use strict';

const L = require('modulog').bound('telemetry')

const P = require('./persistence')

exports.register = (S, opts, next) => {
  S.route({
    method: 'POST',
    path: '/_/frontend/sink',
    handler: (request, reply) => {
      try {
        let data = JSON.parse(request.payload)
        let ip = request.info.remoteAddress
        if (request.info.remoteAddress.split('.')[0] === '127' &&
            'x-forwarded-for' in request.headers) {
          ip = request.headers['x-forwarded-for'].split(',')[0].trim()
        }
        P.writeRecord(ip, data)
        .then(() => reply({ v: 14, s: 'ok' }))
      } catch (e) {
        return reply({ v: 14, s: 'no' })
      }
    }
  })

  S.route({
    method: 'POST',
    path: '/_/frontend/errors',
    handler: (request, reply) => {
      try {
        let data = JSON.parse(request.payload)
        L.debug('Error: %j', data)
        return reply({ v: 14, s: 'ok' })
      } catch (e) {
        return reply({ v: 14, s: 'no' })
      }
    }
  })

  return next()
}

exports.register.attributes = {
  name: 'radiola.telemetry',
  version: '1.1.0',
}
