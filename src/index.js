// const childProcess = require('child_process');
const bodyParser = require('body-parser');
const express = require('express');
const http = require('http');
const path = require('path');
// const shell = require('shelljs');

const utils = require('./utils');

const app = express();
const port = 3000;
const server = http.Server(app);

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

  app.use(express.static('public'));

  // Pre-flight requests.
  app.options('*', (req, res) => {
  	res.send(200);
  });
}

const setupEndpoints = (app) => {
  app.get('/', (req, res) => {
    res.status(200);
    res.json({ working: true });
    res.end();
  });

  // Handle GitHub app user authorisation callback.
  app.get('/callback', (req, res) => {
    console.log(req.body);

    res.status(200);
    res.end();
  });

  // Handle GitHub app webhook.
  app.post('/webhook', (req, res) => {
    console.log(req.body);

    // Extract relevant fields from webhook.
    const commits = req.body.commits;
    const repo = repository.id;

    res.status(200);  
    res.end();
  });
};

setupExpress(app);
setupEndpoints(app);

server.listen(port, (err) => {
  if (err) {
    throw err;
  }

  console.log('Server running on port ' + port);
});
