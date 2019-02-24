const { OK } = require('http-status-codes');
const supertest = require('supertest');

const app = require('../src/app');

describe('/', () => {
  test('returns 200 response', () => (
    supertest(app)
      .get('/')
      .then((response) => {
        expect(response.statusCode).toBe(OK);
        expect(response.text).toBe('test');

        return Promise.resolve();
      })
  ));
});

describe('/webhook', () => {
  test('returns 200 response', () => (
    supertest(app)
      .post('/webhook')
      .send({ installation: { id: 611777 } })
      .then(response => expect(response.statusCode).toBe(OK))
  ));
});
