#!/usr/bin/env node
/**
 * Generate README support matrix block from declared support + certification-status.
 *
 *   node scripts/docs/generate-support-matrix.mjs
 *   node scripts/docs/generate-support-matrix.mjs --check
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  ACTION_ROOT,
  applySupportMatrixBlock,
  assertCertificationGenerated,
  generateSupportMatrixMarkdown,
  loadCertificationStatus
} from './support-matrix-lib.mjs';

const check = process.argv.includes('--check');
const readmePath = path.join(ACTION_ROOT, 'README.md');

function main() {
  assertCertificationGenerated(loadCertificationStatus());
  const block = generateSupportMatrixMarkdown();
  const current = fs.readFileSync(readmePath, 'utf8');
  const next = applySupportMatrixBlock(current, block);

  if (check) {
    if (current !== next) {
      console.error('SUPPORT_MATRIX_OUT_OF_SYNC: README.md support block is stale. Run: npm run docs:support:generate');
      process.exit(1);
    }
    console.log('docs:support:check PASS');
    return;
  }

  fs.writeFileSync(readmePath, next, 'utf8');
  console.log('Updated README.md support matrix block');
}

main();
