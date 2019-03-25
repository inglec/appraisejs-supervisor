/* eslint-disable no-console */
/* eslint-disable promise/always-return */

const { config: loadEnv } = require('dotenv');
const { BAD_REQUEST, OK } = require('http-status-codes');
const supertest = require('supertest');

loadEnv();

const { app, getAccessToken } = require('../src/app');
const mockEvent = require('./push_webhook_event');

const { JEST_WORKER_PORT } = process.env;

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

if (JEST_WORKER_PORT) {
  describe('POST /addWorker', () => {
    test('adds new local worker', () => (
      supertest(app)
        .post('/addWorker')
        .send({ url: `http://127.0.0.1:${JEST_WORKER_PORT}` })
        .then(({ statusCode }) => expect(statusCode).toBe(OK))
    ));
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
} else {
  console.warn('JEST_WORKER_PORT is not set. skipping tests');
}
