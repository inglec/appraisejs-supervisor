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

    return this.queue;
  }

  setOnChange(callback) {
    this.onChange = callback;
  }

  setOnDequeue(callback) {
    this.onDequeue = callback;
  }

  setOnEnqueue(callback) {
    this.onEnqueue = callback;
  }

  length() {
    return this.queue.length;
  }

  isEmpty() {
    return this.length() === 0;
  }
}

module.exports = Queue;
