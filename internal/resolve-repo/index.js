'use strict';

const { setOutput, envStr } = require('../utils/common/io');

function main() {
  const full = envStr('GITHUB_REPOSITORY', '') || envStr('REPOSITORY_FULL_NAME', '');
  if (!full || !full.includes('/')) {
    throw new Error('GITHUB_REPOSITORY (org/repo) e obrigatorio');
  }
  setOutput('repository_full_name', full);
  console.log(`Repositorio resolvido: ${full}`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(`::error::${err.message || err}`);
    process.exit(1);
  }
}

module.exports = { main };
