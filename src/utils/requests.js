const { chain } = require('lodash');

const appendUrlParams = (url, params) => {
  const query = chain(params)
    .map((value, key) => `${key}=${value}`)
    .join('&')
    .value();

  return `${url}?${query}`;
};

const buildUrl = ({
  hostname,
  path,
  port,
  protocol = 'http',
}) => {
  let url = `${protocol}://${hostname}`;
  if (port) {
    url += `:${port}`;
  }
  if (path) {
    url += path;
  }
  return url;
};

const getMissingFields = (object, keys) => (
  keys.reduce((acc, key) => {
    if (!object[key]) {
      acc.push(key);
    }

    return acc;
  }, [])
);

module.exports = { appendUrlParams, buildUrl, getMissingFields };
