'use strict';

const path = require('path');
const { computeFingerprint } = require('./fingerprint');
const { setOutputs, writeJson, ensureDir, envStr } = require('../common/io');

function main() {
  const projectPath = path.resolve(envStr('PROJECT_PATH', '.'));
  const language = envStr('LANGUAGE', '');
  const buildSystem = envStr('BUILD_SYSTEM', '');
  const outputFile = path.resolve(envStr('OUTPUT_FILE', '.veracode-build/fingerprint.json'));

  const result = computeFingerprint(projectPath, { language, buildSystem });
  ensureDir(path.dirname(outputFile));
  writeJson(outputFile, result);

  setOutputs({
    fingerprint: result.value,
    algorithm: result.algorithm,
    files: JSON.stringify(result.files)
  });

  console.log(`Fingerprint ${result.algorithm}: ${result.value}`);
  console.log(`Arquivos (${result.files.length}): ${result.files.join(', ') || '(nenhum)'}`);
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
