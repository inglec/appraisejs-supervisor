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

const githubAPIHeader = {
  'Accept': 'application/vnd.github.machine-man-preview+json',
  'User-Agent': 'AppraiseJs'
};

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
    iss: process.env.APP_ID
  };

  // Sign JSON Web Token and encode with RS256.
  const privateKey = fs.readFileSync(path.join(__dirname, '../keys', 'private-key.pem'));
  const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' });

  cache.storeJWT(token, expiry * 1000);

  return token;
}

const getAccessToken = (installationId) => {
  const token = cache.getAccessToken(installationId, new Date());
  if (token !== null) {
    // Successfully retrieved access token from cache.
    return new Promise(resolve => resolve(token));
  }
  else {
    // Request a new access token from GitHub.
    return utils.httpsRequestPromise({
      headers: {
        ...githubAPIHeader,
        'Authorization': `Bearer ${getJWT()}`
      },
      hostname: 'api.github.com',
      method: 'POST',
      path: `/app/installations/${installationId}/access_tokens`
    }).then((response) => {
      cache.storeAccessToken(installationId, response.token, response.expires_at);
      return response.token;
    });
  }
}

const getRepository = (accessToken, repoFullName) => {
  return utils.httpsRequestPromise({
    headers: {
      ...githubAPIHeader,
      'Authorization': `token ${accessToken}`
    },
    hostname: 'api.github.com',
    method: 'GET',
    path: `/repos/${repoFullName}/commits/693230573f2b7953dee10148004281f73d26bb2f`
  });
};

const processPushWebhook = (payload) => {
  console.log(payload);

  getAccessToken(payload.installation.id)
    .then((token) => {
      console.log(token);

      // getRepository(token, payload.repository.fullname)
      //   .then((response) => console.log(response))
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
  const payload = {
    commits: [{
      id: 'a89615fd890a485930ecb2dfc6eb9b651c3d443e'
    }]
    installation: { id: 584866 },
    repository: { fullname: 'inglec/fyp-test' }
  };

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

  // Clear cached data every 5 minutes.
  setInterval(() => cache.clear(new Date()), 300000);

  // test();
}

main();
