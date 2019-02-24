const _ = require('lodash');

const appendUrlParams = (url, params) => {
  const query = _
    .chain(params)
    .map((value, key) => `${key}=${value}`)
    .join('&')
    .value();

  return `${url}?${query}`;
};

const toHeaderField = array => array.join(', ');

module.exports = { appendUrlParams, toHeaderField };
