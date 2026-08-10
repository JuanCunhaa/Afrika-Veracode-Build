#!/usr/bin/env node
/**
 * Enforce TypeScript Feature Completeness from schemas/typescript-coverage-contract.json.
 *
 * Codes:
 *   TS_COVERAGE_RUNTIME_MISSING
 *   TS_COVERAGE_COMPILER_BOUNDARY_MISSING
 *   TS_COVERAGE_FRAMEWORK_MISSING
 *   TS_COVERAGE_PACKAGE_MANAGER_MISSING
 *   TS_COVERAGE_MODULE_FORMAT_MISSING
 *   TS_COVERAGE_TSX_MISSING
 *   TS_COVERAGE_TYPESCRIPT_VERSION_MISSING
 *   TS_COVERAGE_CONTRACT_INVALID
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ACTION_ROOT = path.resolve(__dirname, '../..');
const LAB_ROOT = process.env.LAB_ROOT
  ? path.resolve(process.env.LAB_ROOT)
  : path.resolve(ACTION_ROOT, '../Afrika-Veracode-Build-Lab');

const { detect } = require('../../internal/discovery/detectors/javascript.js');

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function fullCases(testMatrix) {
  return (testMatrix.typescript || []).filter((c) => (c.profiles || []).includes('full'));
}

function hasExt(root, re) {
  const stack = [root];
  while (stack.length) {
    const cur = stack.pop();
    for (const ent of fs.readdirSync(cur, { withFileTypes: true })) {
      const full = path.join(cur, ent.name);
      if (ent.isDirectory() && ent.name !== 'node_modules') stack.push(full);
      else if (ent.isFile() && re.test(ent.name)) return true;
    }
  }
  return false;
}

function main() {
  const matrixPath = path.join(LAB_ROOT, 'matrix/test-matrix.json');
  if (!fs.existsSync(matrixPath)) {
    console.log(
      [
        '# TypeScript Coverage Contract',
        '',
        `Lab matrix absent at ${matrixPath} — skipping Lab corpus checks (Action-only CI).`,
        '',
        'Result: PASS (skipped)'
      ].join('\n')
    );
    process.exit(0);
  }

  const contract = loadJson(path.join(ACTION_ROOT, 'schemas/typescript-coverage-contract.json'));
  const support = loadJson(path.join(ACTION_ROOT, 'schemas/support-matrix.json'));
  const testMatrix = loadJson(matrixPath);
  /** @type {string[]} */
  const errors = [];
  const cases = fullCases(testMatrix);

  for (const v of (contract.declaredRuntimes || []).map((r) => String(r.version))) {
    const row = (support.rows || []).find((r) => r.capability === 'typescript' && String(r.version).includes(v));
    if (!row) errors.push(`TS_COVERAGE_RUNTIME_MISSING: support-matrix Node ${v}`);
    if (!cases.some((c) => String(c.node) === v)) {
      errors.push(`TS_COVERAGE_RUNTIME_MISSING: Lab full case node=${v}`);
    }
    if (row?.releaseEligible && row.veracodeCertificationRequired) {
      const cert = (row.veracodeCertification?.cases || []).filter((c) => c.required !== false);
      if (!cert.length) errors.push(`TS_COVERAGE_RUNTIME_MISSING: Node ${v} certification cases`);
    }
  }

  for (const b of contract.typescriptCompiler?.labBoundaries || []) {
    const hit = cases.some((c) => {
      if (c.typescriptVersion === b.version) return true;
      const root = path.join(LAB_ROOT, 'applications/typescript', c.case);
      return fs.existsSync(root) && detect(root).typescriptVersion === b.version;
    });
    if (!hit) errors.push(`TS_COVERAGE_COMPILER_BOUNDARY_MISSING: typescript@${b.version} (${b.role})`);
  }

  for (const fw of contract.declaredFrameworks || []) {
    const hit = cases.some((c) => {
      if ((c.framework || 'none') === fw.id) return true;
      const root = path.join(LAB_ROOT, 'applications/typescript', c.case);
      return fs.existsSync(root) && detect(root).framework === fw.id;
    });
    if (!hit) errors.push(`TS_COVERAGE_FRAMEWORK_MISSING: ${fw.displayName}`);
    if (fw.requiresTsx) {
      const ok = cases.some((c) => {
        const root = path.join(LAB_ROOT, 'applications/typescript', c.case);
        return fs.existsSync(root) && hasExt(root, /\.tsx$/i);
      });
      if (!ok) errors.push(`TS_COVERAGE_TSX_MISSING: no .tsx in Full fixtures`);
    }
  }

  for (const c of cases) {
    const root = path.join(LAB_ROOT, 'applications/typescript', c.case);
    if (!fs.existsSync(root)) {
      errors.push(`TS_COVERAGE_CONTRACT_INVALID: missing fixture ${c.case}`);
      continue;
    }
    const d = detect(root);
    if (d.language !== 'typescript') {
      errors.push(`TS_COVERAGE_CONTRACT_INVALID: ${c.case} not detected as typescript`);
    }
    if (!d.typescriptVersion && !c.typescriptVersion) {
      errors.push(`TS_COVERAGE_TYPESCRIPT_VERSION_MISSING: ${c.case}`);
    }
    if (!hasExt(root, /\.(ts|tsx)$/i)) {
      errors.push(`TS_COVERAGE_CONTRACT_INVALID: ${c.case} missing .ts/.tsx sources`);
    }
  }

  for (const pm of contract.packageManagers || []) {
    const hit = cases.some((c) => {
      if (c.packageManager === pm) return true;
      const root = path.join(LAB_ROOT, 'applications/typescript', c.case);
      return fs.existsSync(root) && detect(root).packageManager === pm;
    });
    if (!hit) errors.push(`TS_COVERAGE_PACKAGE_MANAGER_MISSING: ${pm}`);
  }

  for (const mf of contract.moduleFormats || []) {
    const hit = cases.some((c) => {
      if (c.moduleFormat === mf) return true;
      const root = path.join(LAB_ROOT, 'applications/typescript', c.case);
      return fs.existsSync(root) && detect(root).moduleFormat === mf;
    });
    if (!hit) errors.push(`TS_COVERAGE_MODULE_FORMAT_MISSING: ${mf}`);
  }

  if (contract.topology?.workspace === true) {
    errors.push('TS_COVERAGE_CONTRACT_INVALID: workspace=true but Action has no workspace branch');
  }

  const report = [
    '# TypeScript Coverage Contract',
    '',
    `| Metric | Count |`,
    `| --- | ---: |`,
    `| Declared Node runtimes | ${(contract.declaredRuntimes || []).length} |`,
    `| Compiler boundaries | ${(contract.typescriptCompiler?.labBoundaries || []).length} |`,
    `| Declared frameworks | ${(contract.declaredFrameworks || []).length} |`,
    `| Lab Full TS cases | ${cases.length} |`,
    '',
    errors.length ? 'Result: FAIL' : 'Result: PASS',
    ...errors.map((e) => `- ${e}`)
  ].join('\n');

  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);
  if (errors.length) process.exit(1);
}

main();
