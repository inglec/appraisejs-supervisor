class Queue {
  constructor() {
    this.queue = [];
  }

  enqueue(job) {
    this.queue.push(job);
  }

  dequeue() {
    return this.queue.shift();
  }
}

module.exports = Queue;
