const bodyParser = require('body-parser');
// const childProcess = require('child_process');
const express = require('express');
const fs = require('fs');
const http = require('http');
const https = require('https');
const jwt = require('jsonwebtoken');
const path = require('path');
// const shell = require('shelljs');
const httpStatus = require('http-status-codes');

const utils = require('./utils');

const app = express();
const hostname = '127.0.0.1';
const port = 3000;
const server = http.Server(app);

const requestAccessToken = (jwt, installationId) => {
  return utils.httpRequestPromise({
    headers: {
      'Accept': 'application/vnd.github.machine-man-preview+json',
      'Authorization': `Bearer ${jwt}`,
      'User-Agent': 'AppraiseJs'
    },
    hostname: 'api.github.com',
    method: 'POST',
    path: `/app/installations/${installationId}/access_tokens`
  });
};

const processPushWebhook = (payload) => {
  console.log(payload);

  const privateKeyPath = path.join(__dirname, '../keys', 'private-key.pem');
  const jwt = utils.generateJWT(process.env.APP_ID, privateKeyPath);

  requestAccessToken(jwt, payload.installation.id)
    .then((response) => {
      console.log(response);
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
}

setupExpress(app);

server.listen(port, hostname, (err) => {
  if (err) {
    throw err;
  }

  console.log(`Listening on port ${port}...`);
});
