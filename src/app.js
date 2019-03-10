const bodyParser = require('body-parser');
const express = require('express');
const { readFile: readFileCallback } = require('fs');
const { BAD_REQUEST, INTERNAL_SERVER_ERROR } = require('http-status-codes');
const { sign } = require('jsonwebtoken');
const { pick } = require('lodash');
const { join } = require('path');
const { default: createLogger } = require('logging');
const { promisify } = require('util');

const { fetchClientAccessToken, fetchInstallationAccessToken } = require('./utils/github_api');
const { toHeaderField } = require('./utils/requests');
const Cache = require('./Cache');
const Queue = require('./Queue');
const Worker = require('./Worker');

const {
  appId: APP_ID,
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
} = require('../config.json');

const readFile = promisify(readFileCallback);

const PRIVATE_KEY_PATH = join(process.env.NODE_PATH, 'keys/private-key.pem');

const cache = new Cache();
const jobIdQueue = new Queue();
const jobs = {};
const workerIdQueue = new Queue();
const workers = {};

const logger = createLogger('appraisejs');

const getJwt = () => {
  const cachedJwt = cache.getJwt();
  if (cachedJwt) {
    return Promise.resolve(cachedJwt);
  }

  const time = new Date();

  // Generate new JWT
  const seconds = Math.floor(time / 1000);
  const expiry = seconds + (10 * 60);
  const payload = {
    iat: seconds, // Issued at time
    exp: expiry, // Expiration time (10 minute maximum)
    iss: APP_ID,
  };

  return (
    readFile(PRIVATE_KEY_PATH)
      .then((privateKey) => {
        // Sign JSON Web Token and encode with RS256
        const jwt = sign(payload, privateKey, { algorithm: 'RS256' });
        cache.storeJWT(jwt, expiry * 1000);

        return jwt;
      })
  );
};

const getAccessToken = (installationId) => {
  const cachedToken = cache.getAccessToken(installationId, new Date());
  if (cachedToken) {
    logger.debug('retrieved token from cache:', cachedToken);

    return Promise.resolve(cachedToken);
  }

  return (
    getJwt()
      .then(jwt => fetchInstallationAccessToken(installationId, jwt, APP_ID))
      .then((response) => {
        const { expires_at: expiry, token } = response.data;
        cache.storeAccessToken(installationId, token, expiry);
        logger.debug('fetched new token:', token);

        return token;
      })
  );
};

const addJob = (job) => {
  const jobId = `${job.installationId}/${job.owner}/${job.repository}/${job.commitId}`;
  if (jobId in jobs) {
    throw Error(`job ${jobId} already in queue`);
  }

  jobs[jobId] = {
    ...job,
    inProgress: false,
  };
  jobIdQueue.enqueue(jobId);

  logger.debug('new job', jobId, job);
};

const allocateJobs = () => {
  // Pair workers and jobs 1:1
  while (!jobIdQueue.isEmpty && !workerIdQueue.isEmpty) {
    // Get next waiting job and free worker
    const jobId = jobIdQueue.dequeue();
    const workerId = workerIdQueue.dequeue();
    logger.debug('job', jobId, 'being assigned to', workerId);

    const job = jobs[jobId];
    const worker = workers[workerId];

    job.inProgress = true;

    getAccessToken(job.installationId)
      .then(accessToken => (
        worker.allocate(jobId, pick(job, ['commitId', 'owner', 'repository']), accessToken)
      ))
      // TODO: Push job / worker back onto queue
      .catch(logger.error);
  }
};

const addWorker = (ip, port) => {
  const workerId = port ? `${ip}:${port}` : ip;
  if (workerId in workers) {
    throw Error(`worker ${workerId} already exists in pool`);
  }

  workers[workerId] = new Worker(ip, port);
  workerIdQueue.enqueue(workerId);

  logger.debug('new worker', workerId, 'added to pool');

  // Attempt to assign queued jobs to the new worker
  allocateJobs();
};

// https://developer.github.com/v3/activity/events/types/#pushevent
const handlePushEvent = ({ commits, installation, repository }) => {
  // Enqueue new jobs
  commits
    .filter(commit => commit.distinct)
    .forEach((commit) => {
      addJob({
        commitId: commit.id,
        installationId: installation.id,
        owner: repository.owner.login,
        repository: repository.name,
      });
    });

  // Attempt to assign the new jobs to any free workers
  allocateJobs();
};

const setupExpress = () => {
  const app = express();
  const appLogger = createLogger('appraisejs:app');

  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use((req, res, next) => {
    appLogger.debug(req.method, req.originalUrl, req.body);

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

  // Test route
  app.get('/', (req, res) => res.send('test'));

  // Add a new IP to the worker pool
  app.post('/addWorker', (req, res) => {
    const { ip, port } = req.body;

    if (ip) {
      addWorker(ip, port);
      res.end();
    } else {
      res.status(BAD_REQUEST).send('No IP address specified');
    }
  });

  // Proxy client OAuth requests to GitHub
  app.post('/authenticate', (req, res) => {
    // Forward access token request to GitHub
    fetchClientAccessToken(CLIENT_ID, CLIENT_SECRET, req.body.code)
      .then(response => res.send(response.data))
      .catch((err) => {
        appLogger.error(err);
        res.status(INTERNAL_SERVER_ERROR).end();
      });
  });

  // Receive a webhook event from GitHub
  app.post('/webhook', (req, res) => {
    // https://developer.github.com/v3/activity/events/types
    const eventName = req.headers['x-github-event'];
    switch (eventName) {
      case 'push':
        handlePushEvent(req.body);
        res.end();
        break;
      default:
        res.status(BAD_REQUEST).send(`unrecognised webhook event "${eventName}"`);
    }
  });

  return app;
};

function main() {
  const app = setupExpress();

  // Clear cache every 5 minutes
  setInterval(() => cache.clear(new Date()), 300000);

  module.exports = { app, getAccessToken };
}

main();
