const _ = require('lodash');
const https = require('https');

const appendUrlParams = (url, params) => {
  const query = _
    .chain(params)
    .map((value, key) => `${key}=${value}`)
    .join('&')
    .value();

  return `${url}?${query}`;
};

const httpsRequestPromise = (options, payload) => {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let buffer = '';

      res.on('data', (data) => {
        buffer += data.toString();
      });

      res.on('end', () => resolve(buffer));

      res.on('error', err => reject(err));
    });

    req.on('error', err => reject(err));

    if (payload) {
      req.write(payload);
    }

    req.end();
  });
};

const toHeaderField = array => array.join(', ');

const toPrettyString = (string) => {
  const json = JSON.parse(string);
  return JSON.stringify(json, null, 2);
};

module.exports = {
  appendUrlParams,
  httpsRequestPromise,
  toHeaderField,
  toPrettyString
};
