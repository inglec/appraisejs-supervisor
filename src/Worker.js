const requestPromise = require('request-promise-native');
const { default: createLogger } = require('logging');

class Worker {
  constructor(id, url) {
    this.id = id;
    this.url = url;
    this.jobId = null;

    this.logger = createLogger('appraisejs:worker');
  }

  allocate(jobId, job, accessToken) {
    if (!this.isFree) {
      throw Error(`occupied with job ${this.jobId}`);
    }

    this.logger.debug('allocated job', jobId);
    this.jobId = jobId;

    // Allocate job to worker server
    const request = requestPromise({
      method: 'POST',
      uri: `${this.url}/allocate`,
      body: {
        ...job,
        accessToken,
      },
      json: true,
      resolveWithFullResponse: true,
    });

    return (
      request
        .then(response => this.logger.debug('worker responded with status', response.statusCode))
        .catch(error => this.logger.error(error))
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
