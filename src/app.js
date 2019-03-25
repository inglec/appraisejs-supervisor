const bodyParser = require('body-parser');
const express = require('express');
const { readFile: readFileCallback } = require('fs');
const { BAD_REQUEST, INTERNAL_SERVER_ERROR, OK } = require('http-status-codes');
const { sign: signCallback } = require('jsonwebtoken');
const { pick } = require('lodash/object');
const { join } = require('path');
const { default: createLogger } = require('logging');
const requestPromise = require('request-promise-native');
const { promisify } = require('util');

const { fetchClientAccessToken, fetchInstallationAccessToken } = require('./utils/github_api');
const Cache = require('./Cache');
const Queue = require('./Queue');
const Worker = require('./Worker');

const { appId: APP_ID, urls: { apiServer: API_SERVER_URL } } = require('../config.json');

const { CLIENT_ID, CLIENT_SECRET, NODE_PATH } = process.env;
if (!CLIENT_ID) {
  throw Error('environment variable CLIENT_ID not set');
} else if (!CLIENT_SECRET) {
  throw Error('environment variable CLIENT_SECRET not set');
} else if (!NODE_PATH) {
  throw Error('environment variable NODE_PATH not set');
}

const PRIVATE_KEY_PATH = join(NODE_PATH, 'keys/private-key.pem');

const cache = new Cache();
const jobIdQueue = new Queue();
const jobs = {};
const logger = createLogger('appraisejs');
const readFile = promisify(readFileCallback);
const sign = promisify(signCallback);
const workerIdQueue = new Queue();
const workers = {};

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
      .then(privateKey => sign(payload, privateKey, { algorithm: 'RS256' }))
      .then((jwt) => {
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

const createJobId = ({ commitId, owner, repository }) => `${owner}/${repository}/${commitId}`;

const addJob = (job) => {
  const jobId = createJobId(job);
  if (jobId in jobs) {
    throw Error(`job ${jobId} already in queue`);
  }

  logger.debug('adding new job', jobId, job);

  jobs[jobId] = job;
  jobIdQueue.enqueue(jobId);
};

const removeJob = (jobId) => {
  if (jobId in jobs) {
    logger.debug('removing job', jobId);
    delete jobs[jobId];
  } else {
    logger.error('tried to remove non-existent job', jobId);
  }
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

    // Update job in pool
    job.workerId = workerId;

    getAccessToken(job.installationId)
      .then(accessToken => (
        worker.allocate(jobId, pick(job, ['commitId', 'owner', 'repository']), accessToken)
      ))
      // TODO: Push job / worker back onto queue
      .catch(logger.error);
  }
};

const addWorker = async (url) => {
  const { workerId } = await requestPromise({
    uri: `${url}/identity`,
    json: true,
  });

  if (workerId in workers) {
    throw Error(`worker ${workerId} already exists in pool`);
  }

  logger.debug('adding worker', workerId);
  workers[workerId] = new Worker(workerId, url);
  workerIdQueue.enqueue(workerId);

  // Attempt to assign queued jobs to the new worker
  allocateJobs();
};

const freeWorker = (workerId) => {
  logger.debug('free worker', workerId);

  if (workerId in workers) {
    workers[workerId].free();
    workerIdQueue.enqueue(workerId);
  } else {
    logger.error('tried to free non-existent worker', workerId);
  }
};

// https://developer.github.com/v3/activity/events/types/#pushevent
const handlePushEvent = ({ commits, installation, repository }) => {
  const time = new Date().getTime();

  // Enqueue new jobs
  commits
    .filter(commit => commit.distinct)
    .forEach(commit => (
      addJob({
        installationId: installation.id,
        owner: repository.owner.login,
        repository: repository.name,
        repositoryId: repository.id,
        commitId: commit.id,
        queuedAt: time,
        workerId: null,
      })
    ));

  // Attempt to assign the new jobs to any free workers
  allocateJobs();
};

const setupExpress = (clientId, clientSecret) => {
  const app = express();
  const appLogger = createLogger('appraisejs:app');

  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use((req, res, next) => {
    appLogger.debug(req.method, req.originalUrl, req.body);

    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8080');
    res.setHeader('Access-Control-Allow-Methods', 'POST');
    res.setHeader(
      'Access-Control-Allow-Headers',
      ['X-Requested-With', 'Content-Type', 'Accept'].join(', '),
    );

    next();
  });

  // Test route
  app.get('/', (req, res) => res.send('test'));

  // Add a new IP to the worker pool
  app.post('/addWorker', (req, res) => {
    const { url } = req.body;

    if (!url) {
      res.status(BAD_REQUEST).send('No URL specified');
    } else {
      res.end();
      addWorker(url);
    }
  });

  // Proxy client OAuth requests to GitHub
  app.post('/authenticate', (req, res) => {
    const { code } = req.body;

    // Forward access token request to GitHub
    fetchClientAccessToken(clientId, clientSecret, code)
      .then(response => res.send(response.data))
      .catch((err) => {
        appLogger.error(err);
        res.status(INTERNAL_SERVER_ERROR).end();
      });
  });

  // Receive benchmark results from a worker server
  app.post('/results', (req, res) => {
    res.end();

    const {
      commitId,
      owner,
      repository,
      workerId,
    } = req.body;

    const jobId = createJobId({ commitId, owner, repository });
    const job = jobs[jobId];
    logger.debug(job);

    // Data to send to API server
    const data = {
      ...job,
      ...req.body,
    };

    // Send results to API server
    const request = requestPromise({
      method: 'POST',
      uri: `${API_SERVER_URL}/submitTest`,
      body: data,
      json: true,
      resolveWithFullResponse: true,
    });

    request
      .then(({ body, statusCode }) => {
        if (statusCode !== OK) {
          throw Error(`API server returned ${statusCode} response: ${body}`);
        }

        removeJob(jobId);
        freeWorker(workerId);

        return undefined;
      })
      .catch(error => logger.error(error));
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
  const app = setupExpress(CLIENT_ID, CLIENT_SECRET);

  // Clear cache every 5 minutes
  setInterval(() => cache.clear(new Date()), 300000);

  module.exports = { app, getAccessToken };
}

main();
