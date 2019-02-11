const _ = require('lodash');
const esprima = require('esprima');
const escodegen = require('escodegen');

const getFunctionObjects = (program) => {
  // Generate AST from program.
  const parsed = esprima.parse(program, {
    jsx: true, // Support JSX syntax.
    loc: true, // Annotate column + row location.
    range: true, // Annotate index location.
  });

  // TODO: Support function variables.
  const functionNodes = _.filter(parsed.body, node => (
    node.type === esprima.Syntax.FunctionDeclaration
  ));

  return functionNodes;
};

const generateFunctions = functionObjects => (
  _.map(functionObjects, (obj) => {
    // Generate text from AST nodes.
    const body = escodegen.generate(obj.body);
    const params = _.map(obj.params, escodegen.generate);

    // eslint-disable-next-line no-new-func
    return new Function(...params, body);
  })
);

module.exports = {
  generateFunctions,
  getFunctionObjects,
};
