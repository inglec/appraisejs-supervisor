const toHeaderField = array => array.join(', ');

const toPrettyString = (string) => {
  const json = JSON.parse(string);
  const pretty = JSON.stringify(json, null, 2);
  return pretty;
};

module.exports = { toHeaderField, toPrettyString };
