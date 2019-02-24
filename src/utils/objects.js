const toPrettyString = (value) => {
  const json = typeof value === 'string' ? JSON.parse(value) : value;

  return JSON.stringify(json, null, 2);
};

module.exports = { toPrettyString };
