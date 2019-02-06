const toPrettyString = (string) => {
  const json = JSON.parse(string);
  return JSON.stringify(json, null, 2);
};

module.exports = { toPrettyString };
