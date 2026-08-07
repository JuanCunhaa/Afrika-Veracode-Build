'use strict';

const { sanitizeLog } = require('./sanitize');
const { setOutput, envStr } = require('../common/io');

function main() {
  const text = envStr('TEXT', '');
  const sanitized = sanitizeLog(text);
  setOutput('sanitized', sanitized);
}

if (require.main === module) {
  main();
}

module.exports = { main };
