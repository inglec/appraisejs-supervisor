const _ = require('lodash');
const bodyParser = require('body-parser');
const express = require('express');
const fs = require('fs');
const http = require('http');
const httpStatus = require('http-status-codes');
const jwt = require('jsonwebtoken');
const path = require('path');

const config = require('../config.json');
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
    if (cache.jwt !== null && cache.jwt.expiry < timestamp) {
      cache.jwt = null;
      console.log('Cleared expired JWT');
    }
  }
};

// TODO: Implement job queue.
const jobQueue = {
  jobs: [],
  enqueue: function(job) {
    this.jobs.push(job);
  },
  dequeue: function() {
    return this.jobs.shift();
  }
};

const getJWT = () => {
  const time = new Date();

  const cachedJWT = cache.getJWT();
  if (cachedJWT !== null) {
    return cachedJWT;
  }

  // Generate new JWT.
  const seconds = Math.floor(time / 1000);
  const expiry = seconds + (10 * 60);
  const payload = {
    iat: seconds, // Issued at time.
    exp: expiry, // Expiration time (10 minute maximum).
    iss: config.appId
  };

  // Sign JSON Web Token and encode with RS256.
  const privateKey = fs.readFileSync(path.join(__dirname, '../keys', 'private-key.pem'));
  const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' });

  cache.storeJWT(token, expiry * 1000);

  return token;
}

const getAccessTokenPromise = (installationId) => {
  // Attempt to retrieve token from cache.
  const cached = cache.getAccessToken(installationId, new Date());
  if (cached !== null) {
    return Promise.resolve(cached);
  }

  // Request a new access token from GitHub.
  return utils.httpsRequestPromise({
    headers: {
      'Accept': 'application/vnd.github.machine-man-preview+json',
      'Authorization': `Bearer ${getJWT()}`,
      'User-Agent': config.appName
    },
    hostname: 'api.github.com',
    method: 'POST',
    path: `/app/installations/${installationId}/access_tokens`
  })
    .then((response) => {
      const json = JSON.parse(response);
      cache.storeAccessToken(installationId, json.token, json.expires_at);
      return json.token;
    });
}

const processPushWebhook = (payload) => {
  getAccessTokenPromise(payload.installation.id)
    .then((token) => {
      console.log(token);

      // payload.commits.forEach((commit) => {
      //
      // });
    })
    .catch(err => console.log(err))
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

  // GET routes.
  app.get('/', (req, res) => {
    res.status(httpStatus.OK);
    res.send('Test route');
    res.end();
  });

  // POST routes.
  app.post('/authenticate', (req, res) => {
    const postData = {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: req.body.code
    };

    const postConfig = {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      hostname: 'github.com',
      method: 'POST',
      path: '/login/oauth/access_token'
    };

    // Forward access token request to GitHub.
    utils.httpsRequestPromise(postConfig, JSON.stringify(postData))
      .then((response) => {
        console.log(response);
        res.status(httpStatus.OK);
        res.send(response);
        res.end();
      })
      .catch((err) => {
        res.status(httpStatus.INTERNAL_SERVER_ERROR);
        res.end();

        console.log(err);
      });
  });
  app.post('/webhook', (req, res) => {
    res.status(httpStatus.OK);
    res.end();

    processPushWebhook(req.body);
  });
};

const test = () => {
  const text = fs.readFileSync(path.join(__dirname, '../testing', 'sampleWebhook.json'));
  const payload = JSON.parse(text);

  processPushWebhook(payload);
  // setTimeout(() => processPushWebhook(payload), 5000);
};

function main() {
  setupExpress(app);

  server.listen(port, hostname, (err) => {
    if (err) {
      throw err;
    }

    console.log(`Listening on port ${port}...`);
  });

  // Clear cached postData every 5 minutes.
  setInterval(() => cache.clear(new Date()), 300000);

  test();
}

main();
