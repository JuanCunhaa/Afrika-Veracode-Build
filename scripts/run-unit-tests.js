'use strict';

/**
 * Runner cross-platform para node:test (Node 20+/24).
 * Uso:
 *   node scripts/run-unit-tests.js
 *   node scripts/run-unit-tests.js --coverage
 *   node scripts/run-unit-tests.js --root tests/unit --root tests/negative
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, acc);
    else if (ent.isFile() && ent.name.endsWith('.test.js')) acc.push(full);
  }
  return acc;
}

function parseRoots(argv) {
  const roots = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--root' && argv[i + 1]) {
      roots.push(argv[i + 1]);
      i += 1;
    }
  }
  return roots;
}

const root = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const coverage = argv.includes('--coverage');
const roots = parseRoots(argv).map((r) => path.resolve(root, r));
const searchRoots = roots.length > 0 ? roots : [path.join(root, 'tests', 'unit'), path.join(root, 'tests', 'negative')];

const files = [];
for (const dir of searchRoots) {
  walk(dir, files);
}
files.sort((a, b) => a.localeCompare(b));

if (files.length === 0) {
  console.error(`Nenhum teste encontrado em: ${searchRoots.join(', ')}`);
  process.exit(1);
}

const args = [];
if (coverage) {
  args.push('--experimental-test-coverage');
  const major = Number(process.versions.node.split('.')[0]);
  if (major >= 22) {
    args.push('--test-coverage-include=internal/**');
  }
}
args.push('--test', ...files);

const result = spawnSync(process.execPath, args, {
  cwd: root,
  stdio: 'inherit',
  env: process.env
});

process.exit(result.status === null ? 1 : result.status);
