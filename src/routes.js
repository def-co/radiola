'use strict';

exports.register = (S, opts, next) => {
  S.route({
    method: 'GET',
    path: '/stations.json',
    handler: (request, reply) => {
      reply(S.app.stations)
    }
  })

  S.route({
    method: 'GET',
    path: '/{param*}',
    handler: {
      directory: {
        path: 'static'
      }
    }
  })
  return next()
}

exports.register.attributes = {
  name: 'radiola.routes',
  version: '1.1.0',
}
