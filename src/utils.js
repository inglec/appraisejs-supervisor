const fs = require('fs');
const https = require('https');
const jwt = require('jsonwebtoken');

const generateJWT = (appId, privateKeyPath) => {
  const privateKey = fs.readFileSync(privateKeyPath);

  // Get number of seconds since Epoch.
  const time = Math.floor(new Date().getTime() / 1000);
  const payload = {
    iat: time, // Issued at time.
    exp: time + (10 * 60), // Expiration time (10 minute maximum).
    iss: appId
  };

  // Sign JSON Web Token and encode with RS256.
  return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
};

const httpRequestPromise = (options) => {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      var buffer = '';

      res.on('data', (data) => {
        buffer += data.toString();
      });

      res.on('error', err => reject(err));

      res.on('end', () => resolve(JSON.parse(buffer)));
    });

    req.on('error', err => reject(err));

    req.end();
  });
};

const toHeaderField = array => array.join(', ');

const toPrettyString = (string) => {
  const json = JSON.parse(string);
  return JSON.stringify(json, null, 2);
};

module.exports = {
  generateJWT,
  httpRequestPromise,
  toHeaderField,
  toPrettyString
};
