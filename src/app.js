const bodyParser = require('body-parser');
const express = require('express');
const { readFile } = require('fs');
const { INTERNAL_SERVER_ERROR, OK } = require('http-status-codes');
const { sign } = require('jsonwebtoken');
const { join } = require('path');
const { default: createLogger } = require('logging');
const { promisify } = require('util');

const config = require('../config.json');

const Cache = require('./Cache');
// const JobQueue = require('./Queue');
const { fetchClientAccessToken, fetchInstallationAccessToken } = require('./utils/github_api');
const { toHeaderField } = require('./utils/requests');

const readFileAsync = promisify(readFile);

const cache = new Cache();
// const queue = new JobQueue();

const getJwt = () => {
  const cachedJwt = cache.getJwt();
  if (cachedJwt) {
    return Promise.resolve(cachedJwt);
  }

  const time = new Date();

  // Generate new JWT.
  const seconds = Math.floor(time / 1000);
  const expiry = seconds + (10 * 60);
  const payload = {
    iat: seconds, // Issued at time.
    exp: expiry, // Expiration time (10 minute maximum).
    iss: config.appId,
  };

  const privateKeyPath = join(process.env.NODE_PATH, 'keys/private-key.pem');

  return readFileAsync(privateKeyPath).then((privateKey) => {
    // Sign JSON Web Token and encode with RS256.
    const jwt = sign(payload, privateKey, { algorithm: 'RS256' });
    cache.storeJWT(jwt, expiry * 1000);

    return jwt;
  });
};

const getAccessToken = (installationId) => {
  const cachedToken = cache.getAccessToken(installationId, new Date());
  if (cachedToken) {
    return Promise.resolve(cachedToken);
  }

  return getJwt()
    .then(jwt => fetchInstallationAccessToken(installationId, jwt, config.appId))
    .then((response) => {
      const { expires_at: expiry, token } = response.data;
      cache.storeAccessToken(installationId, token, expiry);

      return token;
    });
};

const processPushWebhook = ({ commits, installation }) => (
  getAccessToken(installation.id).then((token) => {
    console.log(token);
    // TODO: Create job for each commit.
    // commits.forEach((commit) => {
    //
    // });

    return Promise.resolve();
  })
);

const setupExpress = () => {
  const app = express();
  const logger = createLogger('App');

  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use((req, res, next) => {
    logger.debug(req.method, req.originalUrl, req.body);

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
  app.get('/', (req, res) => res.status(OK).send('test'));

  // POST routes.
  app.post('/authenticate', (req, res) => {
    // Forward access token request to GitHub.
    fetchClientAccessToken(config.clientId, config.clientSecret, req.body.code)
      .then((response) => {
        res.status(OK).send(response.data);

        return Promise.resolve();
      })
      .catch((err) => {
        logger.error(err);
        res.status(INTERNAL_SERVER_ERROR).end();
      });
  });
  app.post('/webhook', (req, res) => {
    processPushWebhook(req.body)
      .then(() => res.status(OK).end())
      .catch((error) => {
        logger.error(error);

        res.status(INTERNAL_SERVER_ERROR).end();
      });
  });

  return app;
};

const app = setupExpress();

// Clear cache every 5 minutes.
setInterval(() => cache.clear(new Date()), 300000);

module.exports = app;
