const requestPromise = require('request-promise-native');
const { default: createLogger } = require('logging');

const { buildUrl } = require('./utils/requests');

const logger = createLogger('appraisejs:worker');

class Worker {
  constructor(ip, port) {
    this.ip = ip;
    this.port = port;
    this.jobId = null;
  }

  allocate(jobId, job, accessToken) {
    if (!this.isFree) {
      throw Error(`occupied with job ${this.jobId}`);
    }

    logger.debug('allocated job', jobId);
    this.jobId = jobId;

    // Allocate job to worker server
    const request = requestPromise({
      method: 'POST',
      uri: buildUrl({
        hostname: this.ip,
        port: this.port,
        path: '/allocate',
      }),
      body: {
        ...job,
        accessToken,
      },
      json: true,
      resolveWithFullResponse: true,
    });

    return (
      request
        .then(response => logger.debug('worker responded with status', response.statusCode))
        .catch(error => logger.error(error))
    );
  }

  free() {
    this.jobId = null;
  }

  get isFree() {
    return !this.jobId;
  }
}

module.exports = Worker;
