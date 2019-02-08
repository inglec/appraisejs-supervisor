class JobQueue {
  constructor() {
    this.jobs = [];
  }

  enqueue(job) {
    this.jobs.push(job);
  }

  dequeue() {
    return this.jobs.shift();
  }
};

module.exports = JobQueue;
