const bodyParser = require('body-parser');
// const childProcess = require('child_process');
const express = require('express');
const fs = require('fs');
const http = require('http');
const https = require('https');
const jwt = require('jsonwebtoken');
const path = require('path');
// const shell = require('shelljs');

const utils = require('./utils');

const app = express();
const hostname = '127.0.0.1';
const port = 3000;
const server = http.Server(app);

const requestGitHubAccessToken = (appId, installationId) => {
  const token = generateJWT(appId, path.join(__dirname, '../keys', 'private-key.pem'));

  const options = {
    headers: {
      'Accept': 'application/vnd.github.machine-man-preview+json',
      'Authorization': 'Bearer ' + token,
      'User-Agent': 'AppraiseJs'
    },
    hostname: 'api.github.com',
    method: 'POST',
    path: `/app/installations/${installationId}/access_tokens`
  };

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

const processWebhook = (request) => {
  requestGitHubAccessToken(process.env.APP_ID, request.repository.id)
    .then(response => console.log(response))
    .catch(error => console.log(error))
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

  // Pre-flight requests.
  app.options('*', (req, res) => res.send(200));
}

const setupEndpoints = (app) => {
  app.get('/', (req, res) => {
    res.status(200);
    res.json({ working: true });
    res.end();
  });

  // Handle GitHub app user authorisation callback.
  app.get('/callback', (req, res) => {
    res.status(200);
    res.end();

    processWebhook(req.body);
  });

  // Handle GitHub app webhook.
  app.post('/webhook', (req, res) => {
    res.status(200);
    res.end();

    console.log(req.body);
  });
};

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

setupExpress(app);
setupEndpoints(app);

server.listen(port, hostname, (err) => {
  if (err) {
    throw err;
  }

  console.log(`Listening on port ${port}...`);
});
