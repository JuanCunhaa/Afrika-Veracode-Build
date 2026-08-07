'use strict';

/**
 * Runner cross-platform para node:test (Node 20+/24).
 * Uso: node scripts/run-unit-tests.js [--coverage]
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, acc);
    else if (ent.isFile() && ent.name.endsWith('.test.js')) acc.push(full);
  }
  return acc;
}

const root = path.join(__dirname, '..');
const unitRoot = path.join(root, 'tests', 'unit');
const files = walk(unitRoot).sort((a, b) => a.localeCompare(b));

if (files.length === 0) {
  console.error('Nenhum teste encontrado em tests/unit/**/*.test.js');
  process.exit(1);
}

const coverage = process.argv.includes('--coverage');
const args = [];
if (coverage) {
  args.push('--experimental-test-coverage');
  args.push('--test-coverage-include=internal/**');
}
args.push('--test', ...files);

const result = spawnSync(process.execPath, args, {
  cwd: root,
  stdio: 'inherit',
  env: process.env
});

process.exit(result.status === null ? 1 : result.status);
