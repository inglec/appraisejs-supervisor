const _ = require('lodash');
const bodyParser = require('body-parser');
// const childProcess = require('child_process');
const express = require('express');
const fs = require('fs');
const http = require('http');
const httpStatus = require('http-status-codes');
const jwt = require('jsonwebtoken');
const path = require('path');
// const shell = require('shelljs');

const utils = require('./utils');

const app = express();
const hostname = '127.0.0.1';
const port = 3000;
const server = http.Server(app);

const cache = {
  accessTokens: {},
  jwt: null,
  getAccessToken: function(installationId, timestamp) {
    if (installationId in this.accessTokens) {
      const { expiry, token } = this.accessTokens[installationId];
      if (timestamp < expiry) {
        return token;
      }
      delete this.accessTokens[installationId];
    }
    return null;
  },
  getJWT: function(timestamp) {
    if (this.jwt !== null) {
      const { expiry, token } = this.jwt;
      if (timestamp < expiry) {
        return token;
      }
      this.jwt = null;
    }
    return null;
  },
  storeAccessToken: function(installationId, token, timestamp) {
    this.accessTokens[installationId] = {
      expiry: new Date(timestamp),
      token
    };
  },
  storeJWT: function(token, timestamp) {
    this.jwt = {
      expiry: new Date(timestamp),
      token
    };
  },
  clear: function(timestamp) {
    // Clear expired access tokens.
    _.forEach(cache.accessTokens, (accessToken, installationId) => {
      if (timestamp > accessToken.expiry) {
        delete cache.accessTokens[installationId];
        console.log(`Cleared expired access token ${installationId}`);
      }
    });

    // Reset expired JSON Web Token.
    if (cache.jwt.expiry < timestamp) {
      cache.jwt = null;
      console.log('Cleared expired JWT');
    }
  }
};

const getJWT = () => {
  const time = new Date();

  // Attempt to retrieve JWT from cache.
  const cachedJWT = cache.getJWT();
  if (cachedJWT) {
    return cachedJWT;
  }

  // Generate new JWT.
  const seconds = Math.floor(time / 1000);
  const expiry = seconds + (10 * 60);
  const payload = {
    iat: seconds, // Issued at time.
    exp: expiry, // Expiration time (10 minute maximum).
    iss: process.env.APP_ID
  };

  // Sign JSON Web Token and encode with RS256.
  const privateKey = fs.readFileSync(path.join(__dirname, '../keys', 'private-key.pem'));
  const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' });

  // Cache new JWT.
  cache.storeJWT(token, expiry * 1000);

  return token;
}

const requestAccessToken = (installationId) => {
  return utils.httpsRequestPromise({
    headers: {
      'Accept': 'application/vnd.github.machine-man-preview+json',
      'Authorization': `Bearer ${getJWT()}`,
      'User-Agent': 'AppraiseJs'
    },
    hostname: 'api.github.com',
    method: 'POST',
    path: `/app/installations/${installationId}/access_tokens`
  }).then((response) => {
    // Cache access token for one hour.
    cache.storeAccessToken(installationId, response.token, response.expires_at);
    return response.token;
  })
};

const processPushWebhook = (payload) => {
  // Attempt to retrieve access token from cache.
  new Promise((resolve, reject) => {
    const token = cache.getAccessToken(payload.installation.id, new Date());
    if (token === null) {
      reject('No cached token');
    }
    else {
      resolve(token);
    }
  })
    .catch((err) => {
      // Access token is not cached, so we request a new one.
      return requestAccessToken(payload.installation.id);
    })
    .then((accessToken) => {
      // We have our access token at this point.
      console.log(accessToken);
    })
};

const setupExpress = (app) => {
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8080');
    res.setHeader(
      'Access-Control-Allow-Methods',
      utils.toHeaderField(['GET', 'POST', 'OPTIONS', 'PUT', 'PATCH', 'DELETE'])
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      utils.toHeaderField(['X-Requested-With', 'Content-Type', 'Accept'])
    );
    next();
  });

  // Routes.
  app.get('/', (req, res) => {
    res.status(httpStatus.OK);
    res.send('Hello world');
    res.end();
  });
  app.get('/callback', (req, res) => {
    res.status(httpStatus.OK);
    res.end();

    console.log(req.body);
  });
  app.post('/webhook', (req, res) => {
    res.status(httpStatus.OK);
    res.end();

    processPushWebhook(req.body);
  });
};

const test = () => {
  processPushWebhook({ installation: { id: 584866 } });

  setTimeout(() => processPushWebhook({ installation: { id: 584866 } }), 5000);
};

function main() {
  setupExpress(app);

  server.listen(port, hostname, (err) => {
    if (err) {
      throw err;
    }

    console.log(`Listening on port ${port}...`);
  });

  // Clear cached data every 5 minutes.
  setInterval(() => cache.clear(new Date()), 300000);

  test();
}

main();
