#!/usr/bin/env node
/**
 * Enforce .NET Framework Feature Completeness from schemas/dotnet-framework-coverage-contract.json.
 *
 * Codes:
 *   DOTNET_FW_COVERAGE_RUNTIME_MISSING
 *   DOTNET_FW_COVERAGE_PROJECT_TYPE_MISSING
 *   DOTNET_FW_COVERAGE_LANGUAGE_MISSING
 *   DOTNET_FW_COVERAGE_CONTRACT_INVALID
 *   DOTNET_FW_COVERAGE_FORBIDDEN_VERSION
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

const { detect } = require('../../internal/discovery/detectors/dotnet.js');

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function fullCases(testMatrix) {
  return (testMatrix.dotnetFramework || []).filter((c) => (c.profiles || []).includes('full'));
}

function main() {
  const contract = loadJson(path.join(ACTION_ROOT, 'schemas/dotnet-framework-coverage-contract.json'));
  const support = loadJson(path.join(ACTION_ROOT, 'schemas/support-matrix.json'));
  const testMatrix = loadJson(path.join(LAB_ROOT, 'matrix/test-matrix.json'));
  /** @type {string[]} */
  const errors = [];
  const cases = fullCases(testMatrix);
  const caseIds = new Set(cases.map((c) => c.case));

  for (const v of (contract.declaredRuntimes || []).map((r) => String(r.version))) {
    const row = (support.rows || []).find(
      (r) => r.capability === 'dotnet-framework' && String(r.version) === v
    );
    if (!row) errors.push(`DOTNET_FW_COVERAGE_RUNTIME_MISSING: support-matrix Framework ${v}`);
    if (row?.releaseEligible && row.veracodeCertificationRequired) {
      const cert = (row.veracodeCertification?.cases || []).filter((c) => c.required !== false);
      if (!cert.length) {
        errors.push(`DOTNET_FW_COVERAGE_RUNTIME_MISSING: Framework ${v} certification cases`);
      }
    }
  }

  for (const banned of contract.potentialLegacyExpansion?.versionsNotDeclared || []) {
    if (cases.some((c) => String(c.version) === banned || String(c.case).includes(banned.replace('.', '')))) {
      // only fail if a Full case clearly targets undeclared version folders like net47
      if (cases.some((c) => new RegExp(`net${banned.replace(/\./g, '')}\\b`, 'i').test(c.case))) {
        errors.push(`DOTNET_FW_COVERAGE_FORBIDDEN_VERSION: Lab Full includes undeclared ${banned}`);
      }
    }
  }

  for (const pt of contract.projectTypes || []) {
    if (pt.required === false) continue;
    const id = contract.caseMap?.[pt.id];
    if (!id) {
      errors.push(`DOTNET_FW_COVERAGE_CONTRACT_INVALID: caseMap.${pt.id} missing`);
      continue;
    }
    if (!caseIds.has(id)) {
      errors.push(`DOTNET_FW_COVERAGE_PROJECT_TYPE_MISSING: ${pt.id} (${id})`);
    }
    const root = path.join(LAB_ROOT, 'applications/dotnet', id);
    if (!fs.existsSync(root)) {
      errors.push(`DOTNET_FW_COVERAGE_PROJECT_TYPE_MISSING: fixture missing ${id}`);
      continue;
    }
    const lab = path.join(root, '.veracode-lab.json');
    if (!fs.existsSync(lab)) {
      errors.push(`DOTNET_FW_COVERAGE_CONTRACT_INVALID: ${id} missing .veracode-lab.json`);
    } else {
      const goat = loadJson(lab);
      if (!(goat.minimumStaticFindings >= 1)) {
        errors.push(`DOTNET_FW_COVERAGE_CONTRACT_INVALID: ${id} minimumStaticFindings < 1`);
      }
    }
    const d = detect(root);
    if (!d || d.language !== 'dotnet') {
      errors.push(`DOTNET_FW_COVERAGE_CONTRACT_INVALID: ${id} not detected as dotnet`);
    } else if (pt.id === 'aspnet' && d.framework !== 'aspnet' && d.projectType !== 'aspnet') {
      errors.push(`DOTNET_FW_COVERAGE_CONTRACT_INVALID: ${id} not classified as classic aspnet`);
    } else if (pt.id === 'vbnet') {
      const hasVb = fs.readdirSync(root).some((f) => /\.vbproj$/i.test(f));
      if (!hasVb) errors.push(`DOTNET_FW_COVERAGE_LANGUAGE_MISSING: ${id} missing .vbproj`);
    }
    if (cases.find((c) => c.case === id)?.os && cases.find((c) => c.case === id).os !== 'windows-latest') {
      errors.push(`DOTNET_FW_COVERAGE_CONTRACT_INVALID: ${id} must run on windows-latest`);
    }
  }

  if (!(contract.languages || []).includes('csharp')) {
    errors.push('DOTNET_FW_COVERAGE_LANGUAGE_MISSING: csharp');
  }
  if (!(contract.languages || []).includes('vbnet')) {
    errors.push('DOTNET_FW_COVERAGE_LANGUAGE_MISSING: vbnet');
  }

  const report = [
    '# .NET Framework Coverage Contract',
    '',
    `| Metric | Count |`,
    `| --- | ---: |`,
    `| Declared runtimes | ${(contract.declaredRuntimes || []).length} |`,
    `| Project type rules | ${(contract.projectTypes || []).filter((p) => p.required !== false).length} |`,
    `| Lab Full Framework cases | ${cases.length} |`,
    '',
    errors.length ? 'Result: FAIL' : 'Result: PASS',
    ...errors.map((e) => `- ${e}`)
  ].join('\n');

  console.log(report);
  if (errors.length) process.exit(1);
}

main();
