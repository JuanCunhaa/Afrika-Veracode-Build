'use strict';

const path = require('path');
const { createZip, zipDirectoryContents } = require('./artifact');
const { setOutput, envStr, ensureDir } = require('../common/io');
const { fail, ERROR_CODES } = require('../errors/errors');

function main() {
  const sourcesRaw = envStr('SOURCES', '[]');
  const outputDir = path.resolve(envStr('OUTPUT_DIR', '.veracode-build'));
  const artifactName = envStr('ARTIFACT_NAME', 'analysisPack.zip');
  const mode = envStr('MODE', 'files');
  let excludeNames = [];
  try {
    excludeNames = JSON.parse(envStr('EXCLUDE_NAMES', '[]'));
  } catch {
    excludeNames = ['node_modules', '.git', 'coverage'];
  }

  let sources;
  try {
    sources = JSON.parse(sourcesRaw);
  } catch {
    fail(ERROR_CODES.PACKAGING_FAILED, 'SOURCES deve ser um JSON array de caminhos');
  }

  ensureDir(outputDir);
  const outZip = path.join(outputDir, artifactName);

  try {
    if (mode === 'directory-contents' && sources.length === 1) {
      zipDirectoryContents(sources[0], outZip, { excludeNames });
    } else {
      createZip(sources, outZip, { excludeNames });
    }
  } catch (err) {
    fail(ERROR_CODES.PACKAGING_FAILED, err.message || String(err), {
      stage: 'Packaging'
    });
  }

  setOutput('artifact_path', outZip);
  console.log(`Artifact gerado: ${outZip}`);
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
