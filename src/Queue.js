class Queue {
  constructor() {
    this.clear();
  }

  clear() {
    this.queue = [];

    if (typeof this.onChange === 'function') {
      this.onChange([], 'clear');
    }
  }

  enqueue(enqueued) {
    this.queue.push(enqueued);

    if (typeof this.onChange === 'function') {
      this.onChange(enqueued, this.queue, 'enqueue');
    }

    if (typeof this.onEnqueue === 'function') {
      this.onEnqueue(enqueued, this.queue);
    }

    return this.queue;
  }

  dequeue() {
    const dequeued = this.queue.shift();

    if (typeof this.onChange === 'function') {
      this.onChange(dequeued, this.queue, 'dequeue');
    }

    if (typeof this.onDequeue === 'function') {
      this.onDequeue(dequeued, this.queue);
    }

    return dequeued;
  }

  get length() {
    return this.queue.length;
  }

  get isEmpty() {
    return this.queue.length === 0;
  }
}

module.exports = Queue;
