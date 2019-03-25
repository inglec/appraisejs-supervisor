const commandLineArgs = require('command-line-args');
const { default: createLogger } = require('logging');
const supertest = require('supertest');

const { app } = require('./app');

const { PORT } = process.env;
if (!PORT) {
  throw Error('environment variable PORT not set');
}

function main() {
  const args = commandLineArgs({ name: 'worker', type: String, multiple: true });

  app.listen(PORT, (err) => {
    if (err) {
      throw err;
    }

    const logger = createLogger('appraisejs');
    logger.info(`Listening on port ${process.env.PORT}`);

    if (args.worker) {
      args.worker.forEach((worker) => {
        // eslint-disable-next-line promise/no-promise-in-callback
        supertest(app)
          .post('/addWorker')
          .send({ url: worker })
          .catch(error => logger.error(error));
      });
    }
  });
}

main();
