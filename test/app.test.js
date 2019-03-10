/* eslint-disable promise/always-return */

const { BAD_REQUEST, OK } = require('http-status-codes');
const supertest = require('supertest');

const { app, getAccessToken } = require('../src/app');
const mockEvent = require('./push_webhook_event');

describe('getAccessToken', () => {
  test('resolves with token', () => (
    expect(getAccessToken(mockEvent.installation.id))
      .resolves
      .toMatch(/^v1\.[a-z|0-9]+$/)
  ));

  test('rejects without token', () => {
    expect(getAccessToken())
      .rejects
      .toThrow('Request failed with status code 404');
  });
});

describe('GET /', () => {
  test('returns response', () => (
    supertest(app)
      .get('/')
      .then(({ statusCode, text }) => {
        expect(statusCode).toBe(OK);
        expect(text).toBe('test');
      })
  ));
});

describe('POST /addWorker', () => {
  test('adds new local worker', () => {
    const port = parseInt(process.env.WORKER_PORT, 10);
    expect(port).not.toBe(NaN);

    return supertest(app)
      .post('/addWorker')
      .send({ ip: '127.0.0.1', port })
      .then(({ statusCode }) => expect(statusCode).toBe(OK));
  });
});

describe('POST /webhook', () => {
  test('returns 400 when no header', () => (
    supertest(app)
      .post('/webhook')
      .send(mockEvent)
      .then(({ statusCode, text }) => {
        expect(statusCode).toBe(BAD_REQUEST);
        expect(text).toBe('unrecognised webhook event "undefined"');
      })
  ));

  test('handles mock push event', () => (
    supertest(app)
      .post('/webhook')
      .set('x-github-event', 'push')
      .send(mockEvent)
      .then(({ statusCode }) => expect(statusCode).toBe(OK))
  ));
});
