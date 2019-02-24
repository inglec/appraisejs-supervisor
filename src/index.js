const bodyParser = require('body-parser');
const express = require('express');
const { readFileSync } = require('fs');
const { INTERNAL_SERVER_ERROR, OK } = require('http-status-codes');
const { sign } = require('jsonwebtoken');
const { join } = require('path');

const config = require('../config.json');

const Cache = require('./cache');
// const JobQueue = require('./job_queue');
const { getAccessToken, getInstallationAccessToken } = require('./utils/github_api');
const { toHeaderField } = require('./utils/requests');

const cache = new Cache();
// const queue = new JobQueue();

const getJWT = () => {
  const time = new Date();

  const cachedJwt = cache.getJWT();
  if (cachedJwt !== null) {
    return cachedJwt;
  }

  // Generate new JWT.
  const seconds = Math.floor(time / 1000);
  const expiry = seconds + (10 * 60);
  const payload = {
    iat: seconds, // Issued at time.
    exp: expiry, // Expiration time (10 minute maximum).
    iss: config.appId,
  };

  // Sign JSON Web Token and encode with RS256.
  const privateKey = readFileSync(join(__dirname, '../keys', 'private-key.pem'));
  const jwt = sign(payload, privateKey, { algorithm: 'RS256' });

  cache.storeJWT(jwt, expiry * 1000);

  return jwt;
};

const getAccessTokenPromise = (installationId) => {
  const cachedToken = cache.getAccessToken(installationId, new Date());

  return cachedToken !== null
    ? Promise.resolve(cachedToken)
    : getInstallationAccessToken(installationId, getJWT(), config.appId)
      .then((response) => {
        const { expires_at: expiry, token } = response.data;
        cache.storeAccessToken(installationId, token, expiry);

        return token;
      });
};

const processPushWebhook = (payload) => {
  getAccessTokenPromise(payload.installation.id)
    .then((token) => {
      console.log(token);

      // TODO: Create job for each commit.
      // payload.commits.forEach((commit) => {
      //
      // });
    })
    .catch(err => console.log(err));
};

const setupExpress = () => {
  const app = express();

  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8080');
    res.setHeader(
      'Access-Control-Allow-Methods',
      toHeaderField(['GET', 'POST', 'OPTIONS', 'PUT', 'PATCH', 'DELETE']),
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      toHeaderField(['X-Requested-With', 'Content-Type', 'Accept']),
    );
    next();
  });

  // GET routes.
  app.get('/', (req, res) => {
    res.status(OK);
    res.send('Test route');
    res.end();
  });

  // POST routes.
  app.post('/authenticate', (req, res) => {
    // Forward access token request to GitHub.
    getAccessToken(config.clientId, config.clientSecret, req.body.code)
      .then((response) => {
        res.status(OK);
        res.send(response.data);
        res.end();
      })
      .catch((err) => {
        res.status(INTERNAL_SERVER_ERROR);
        res.end();

        console.error(err);
      });
  });
  app.post('/webhook', (req, res) => {
    res.status(OK);
    res.end();

    processPushWebhook(req.body);
  });

  app.listen(process.env.PORT, (err) => {
    if (err) {
      throw err;
    }

    console.log(`Listening on port ${process.env.PORT}...`);
  });
};

const test = () => {
  processPushWebhook({ installation: { id: 611777 } });
};

function main() {
  setupExpress();

  // Clear cached postData every 5 minutes.
  setInterval(() => cache.clear(new Date()), 300000);

  test();
}

main();
