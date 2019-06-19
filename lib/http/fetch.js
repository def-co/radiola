"use strict";

const http = require('http'),
      https = require('https'),
      tls = require('tls'),
      fetch = require('node-fetch');

const httpAgent = new http.Agent(),
      httpsAgent = new https.Agent({
        rejectUnauthorized: false,
        checkServerIdentity: (host, cert) => {
          let err = tls.checkServerIdentity(host, cert);
          if (err) {
            console.log('host verification failed: %s', host, err);
            return err;
          }
        },
      });

module.exports = (url, options) => {
  options = options || { };

  if ( ! ('agent' in options)) {
    options.agent = (url) => {
      switch (url.protocol) {
        case 'http:': return httpAgent;
        case 'https:': return httpsAgent;
        default: throw new Error(`Unknown protocol: ${url.protocol}`);
      };
    };
  }

  let headers = options.headers || (options.headers = { });
  if ( ! ('User-Agent' in headers)) {
    headers['User-Agent'] = 'P22 Callisto v1.00 (+https://p22.co)';
  }

  return fetch(url, options);
}
