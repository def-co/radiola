"use strict";

const http = require('http'),
      https = require('https'),
      url = require('url');

const httpAgent = new http.Agent(),
      httpsAgent = new https.Agent();

const version = require('../package.json').version;
const DEFAULT_USER_AGENT =
    `Radiola/v${version} (https://radiola.p22.co; +https://p22.co)`;

// Partial polyfill of WHATWG fetch
//   https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
// Polyfill API design influenced by:
//   https://github.github.io/fetch/
exports.fetch = (target, params = { }) => new Promise((resolve, reject) => {
  if ( ! (target instanceof url.URL)) {
    target = new url.URL(target);
  }

  let agent, invokee;
  if (target.protocol === 'https:') {
    agent = httpsAgent;
    invokee = https;
  } else if (target.protocol === 'http:') {
    agent = httpAgent;
    invokee = http;
  } else {
    reject(new Error(`Unsupported URL protocol: ${target.protocol}`));
    return;
  }

  let method = params.method || 'GET';
  let headers = lowercaseKeys(params.headers || { });
  if ( ! ('user-agent' in headers)) {
    headers['user-agent'] = DEFAULT_USER_AGENT;
  }

  invokee.request(target, {
    agent,
    method,
    headers,
  }, (response) => {
    if ('headers'
  });
});
