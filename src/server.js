const { default: createLogger } = require('logging');

const app = require('./app');

const logger = createLogger('Server');

app.listen(process.env.PORT, (err) => {
  if (err) {
    throw err;
  }

  logger.info(`Listening on port ${process.env.PORT}...`);
});
