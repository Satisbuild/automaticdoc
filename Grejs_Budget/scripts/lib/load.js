// Indlæser appens browsermoduler i Node (de hænger sig selv på globalThis.GB).
'use strict';
const path = require('path');

const MODULES = ['util', 'import', 'pdf-import', 'categorization', 'transactions', 'analytics', 'budgets', 'recurring', 'insights', 'export', 'sample-data', 'storage'];

function load() {
  for (const m of MODULES) require(path.join(__dirname, '..', '..', 'js', m + '.js'));
  return globalThis.GB;
}

module.exports = { load, MODULES };
