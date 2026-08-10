#!/usr/bin/env node
/**
 * Enforce JavaScript Feature Completeness from schemas/javascript-coverage-contract.json.
 *
 * Codes:
 *   JS_COVERAGE_RUNTIME_MISSING
 *   JS_COVERAGE_FRAMEWORK_MISSING
 *   JS_COVERAGE_PACKAGE_MANAGER_MISSING
 *   JS_COVERAGE_MODULE_FORMAT_MISSING
 *   JS_COVERAGE_JSX_MISSING
 *   JS_COVERAGE_FRAMEWORK_VERSION_MISSING
 *   JS_COVERAGE_CONTRACT_INVALID
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
  return (testMatrix.javascript || []).filter((c) => (c.profiles || []).includes('full'));
}

function main() {
  const contract = loadJson(path.join(ACTION_ROOT, 'schemas/javascript-coverage-contract.json'));
  const support = loadJson(path.join(ACTION_ROOT, 'schemas/support-matrix.json'));
  const testMatrix = loadJson(path.join(LAB_ROOT, 'matrix/test-matrix.json'));
  /** @type {string[]} */
  const errors = [];
  const cases = fullCases(testMatrix);

  const runtimes = (contract.declaredRuntimes || []).map((r) => String(r.version));
  for (const v of runtimes) {
    const row = (support.rows || []).find(
      (r) => r.capability === 'javascript' && String(r.version).includes(v)
    );
    if (!row) {
      errors.push(`JS_COVERAGE_RUNTIME_MISSING: support-matrix row for Node ${v}`);
      continue;
    }
    const hit = cases.some((c) => String(c.node) === v);
    if (!hit) errors.push(`JS_COVERAGE_RUNTIME_MISSING: Lab full case with node=${v}`);
    if (row.releaseEligible && row.veracodeCertificationRequired) {
      const cert = (row.veracodeCertification?.cases || []).filter((c) => c.required !== false);
      if (!cert.length) {
        errors.push(`JS_COVERAGE_RUNTIME_MISSING: Node ${v} missing Pipeline certification cases`);
      }
    }
  }

  for (const fw of contract.declaredFrameworks || []) {
    const hit = cases.some((c) => (c.framework || 'none') === fw.id);
    if (!hit) {
      // also accept discovery against fixture roots
      const byFixture = cases.some((c) => {
        const root = path.join(LAB_ROOT, 'applications/javascript', c.case);
        if (!fs.existsSync(root)) return false;
        return detect(root).framework === fw.id;
      });
      if (!byFixture) errors.push(`JS_COVERAGE_FRAMEWORK_MISSING: ${fw.displayName} (${fw.id})`);
    }
    if (fw.requiresJsx) {
      const jsxOk = cases.some((c) => {
        const root = path.join(LAB_ROOT, 'applications/javascript', c.case);
        if (!fs.existsSync(root)) return false;
        const stack = [root];
        while (stack.length) {
          const cur = stack.pop();
          for (const ent of fs.readdirSync(cur, { withFileTypes: true })) {
            const full = path.join(cur, ent.name);
            if (ent.isDirectory() && ent.name !== 'node_modules') stack.push(full);
            else if (ent.isFile() && /\.jsx$/i.test(ent.name)) return true;
          }
        }
        return false;
      });
      if (!jsxOk) errors.push(`JS_COVERAGE_JSX_MISSING: no .jsx source in Full matrix fixtures`);
    }
    if (fw.id !== 'none' && fw.depKey) {
      const versioned = cases.some((c) => {
        if ((c.framework || '') !== fw.id) return false;
        if (c.frameworkVersion) return true;
        const root = path.join(LAB_ROOT, 'applications/javascript', c.case);
        const d = detect(root);
        return Boolean(d.frameworkVersion);
      });
      if (!versioned) {
        errors.push(`JS_COVERAGE_FRAMEWORK_VERSION_MISSING: ${fw.id} lacks package.json-derived version metadata`);
      }
    }
  }

  for (const pm of contract.packageManagers || []) {
    const hit = cases.some((c) => {
      if (c.packageManager === pm) return true;
      const root = path.join(LAB_ROOT, 'applications/javascript', c.case);
      return fs.existsSync(root) && detect(root).packageManager === pm;
    });
    if (!hit) errors.push(`JS_COVERAGE_PACKAGE_MANAGER_MISSING: ${pm}`);
  }

  for (const mf of contract.moduleFormats || []) {
    const hit = cases.some((c) => {
      if (c.moduleFormat === mf) return true;
      const root = path.join(LAB_ROOT, 'applications/javascript', c.case);
      return fs.existsSync(root) && detect(root).moduleFormat === mf;
    });
    if (!hit) errors.push(`JS_COVERAGE_MODULE_FORMAT_MISSING: ${mf}`);
  }

  if (contract.topology?.workspace === true) {
    errors.push('JS_COVERAGE_CONTRACT_INVALID: workspace=true but Action has no workspace branch');
  }

  const report = [
    '# JavaScript Coverage Contract',
    '',
    `| Metric | Count |`,
    `| --- | ---: |`,
    `| Declared Node runtimes | ${runtimes.length} |`,
    `| Declared frameworks | ${(contract.declaredFrameworks || []).length} |`,
    `| Lab Full JS cases | ${cases.length} |`,
    '',
    errors.length ? 'Result: FAIL' : 'Result: PASS',
    ...errors.map((e) => `- ${e}`)
  ].join('\n');

  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);
  if (errors.length) process.exit(1);
}

main();
