const https = require('https');

const httpsRequestPromise = (options, payload) => {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let buffer = '';

      res.on('data', (data) => {
        buffer += data.toString();
      });

      res.on('error', err => reject(err));

      res.on('end', () => resolve(JSON.parse(buffer)));
    });

    req.on('error', err => reject(err));

    if (payload) {
      req.send(payload);
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
  httpsRequestPromise,
  toHeaderField,
  toPrettyString
};
