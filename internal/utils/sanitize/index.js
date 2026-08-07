'use strict';

const { sanitizeText, sanitizeLog } = require('./sanitize');
const { setOutput, envStr } = require('../common/io');

function main() {
  const text = envStr('TEXT', '');
  const sanitized = sanitizeText(text);
  setOutput('sanitized', sanitized);
}

if (require.main === module) {
  main();
}

module.exports = { main, sanitizeText, sanitizeLog };
