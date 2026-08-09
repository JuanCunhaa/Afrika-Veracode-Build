#!/usr/bin/env node
/**
 * Generate README support matrix block from declared support + certification-status.
 *
 *   node scripts/docs/generate-support-matrix.mjs
 *   node scripts/docs/generate-support-matrix.mjs --check
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
  ACTION_ROOT,
  applySupportMatrixBlock,
  assertCertificationGenerated,
  generateSupportMatrixMarkdown,
  loadCertificationStatus
} from './support-matrix-lib.mjs';

const require = createRequire(import.meta.url);
const prettier = require('prettier');

const check = process.argv.includes('--check');
const readmePath = path.join(ACTION_ROOT, 'README.md');

/**
 * @param {string} markdown
 */
async function formatReadme(markdown) {
  const config = (await prettier.resolveConfig(readmePath)) || {};
  return prettier.format(markdown, { ...config, filepath: readmePath });
}

async function main() {
  assertCertificationGenerated(loadCertificationStatus());
  const block = generateSupportMatrixMarkdown();
  const current = fs.readFileSync(readmePath, 'utf8');
  const nextRaw = applySupportMatrixBlock(current, block);
  const next = await formatReadme(nextRaw);
  const currentFormatted = await formatReadme(current);

  if (check) {
    if (currentFormatted !== next) {
      console.error('SUPPORT_MATRIX_OUT_OF_SYNC: README.md support block is stale. Run: npm run docs:support:generate');
      process.exit(1);
    }
    console.log('docs:support:check PASS');
    return;
  }

  fs.writeFileSync(readmePath, next, 'utf8');
  console.log('Updated README.md support matrix block');
}

main().catch((err) => {
  console.error(String(err && err.message ? err.message : err));
  process.exit(1);
});
