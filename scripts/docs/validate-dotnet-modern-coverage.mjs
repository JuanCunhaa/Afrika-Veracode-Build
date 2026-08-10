#!/usr/bin/env node
/**
 * Enforce .NET modern Feature Completeness from schemas/dotnet-modern-coverage-contract.json.
 *
 * Codes:
 *   DOTNET_COVERAGE_RUNTIME_MISSING
 *   DOTNET_COVERAGE_PROJECT_TYPE_MISSING
 *   DOTNET_COVERAGE_LANGUAGE_MISSING
 *   DOTNET_COVERAGE_CONTRACT_INVALID
 *   DOTNET_COVERAGE_FORBIDDEN_PRODUCT_LINE
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ACTION_ROOT = path.resolve(__dirname, '../..');
const LAB_ROOT = process.env.LAB_ROOT
  ? path.resolve(process.env.LAB_ROOT)
  : path.resolve(ACTION_ROOT, '../Afrika-Veracode-Build-Lab');

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function fullCases(testMatrix) {
  return (testMatrix.dotnetModern || []).filter((c) => (c.profiles || []).includes('full'));
}

function main() {
  const contract = loadJson(path.join(ACTION_ROOT, 'schemas/dotnet-modern-coverage-contract.json'));
  const support = loadJson(path.join(ACTION_ROOT, 'schemas/support-matrix.json'));
  const testMatrix = loadJson(path.join(LAB_ROOT, 'matrix/test-matrix.json'));
  /** @type {string[]} */
  const errors = [];
  const cases = fullCases(testMatrix);
  const caseIds = new Set(cases.map((c) => c.case));

  for (const v of (contract.declaredRuntimes || []).map((r) => String(r.version))) {
    const row = (support.rows || []).find(
      (r) => r.capability === 'dotnet-modern' && String(r.version) === v
    );
    if (!row) errors.push(`DOTNET_COVERAGE_RUNTIME_MISSING: support-matrix .NET ${v}`);
    const consoleCase = contract.caseMap?.console?.[v];
    if (!consoleCase || !caseIds.has(consoleCase)) {
      errors.push(`DOTNET_COVERAGE_RUNTIME_MISSING: Lab full console for .NET ${v}`);
    }
    if (row?.releaseEligible && row.veracodeCertificationRequired) {
      const cert = (row.veracodeCertification?.cases || []).filter((c) => c.required !== false);
      if (!cert.length) {
        errors.push(`DOTNET_COVERAGE_RUNTIME_MISSING: .NET ${v} certification cases`);
      }
    }
  }

  for (const pt of contract.projectTypes || []) {
    const boundaries = pt.requiredOnBoundaries || pt.requiredOnRuntimes || [];
    for (const v of boundaries) {
      const id = contract.caseMap?.[pt.id]?.[String(v)];
      if (!id) {
        errors.push(`DOTNET_COVERAGE_CONTRACT_INVALID: caseMap.${pt.id}.${v} missing`);
        continue;
      }
      if (!caseIds.has(id)) {
        errors.push(`DOTNET_COVERAGE_PROJECT_TYPE_MISSING: ${pt.id} @ net${v} (${id})`);
      }
      const root = path.join(LAB_ROOT, 'applications/dotnet', id);
      if (!fs.existsSync(root)) {
        errors.push(`DOTNET_COVERAGE_PROJECT_TYPE_MISSING: fixture missing ${id}`);
      } else {
        const lab = path.join(root, '.veracode-lab.json');
        if (!fs.existsSync(lab)) {
          errors.push(`DOTNET_COVERAGE_CONTRACT_INVALID: ${id} missing .veracode-lab.json`);
        } else {
          const goat = loadJson(lab);
          if (!(goat.minimumStaticFindings >= 1)) {
            errors.push(`DOTNET_COVERAGE_CONTRACT_INVALID: ${id} minimumStaticFindings < 1`);
          }
        }
      }
    }
  }

  if (!(contract.languages || []).includes('vbnet') || !caseIds.has(contract.caseMap?.vbnet?.['8'])) {
    errors.push('DOTNET_COVERAGE_LANGUAGE_MISSING: VB.NET branch');
  }
  if (!(contract.languages || []).includes('csharp')) {
    errors.push('DOTNET_COVERAGE_LANGUAGE_MISSING: C#');
  }

  // Guardrails: do not silently productize forbidden lines in Lab Full.
  for (const banned of ['net10-aspnet-core', 'net10-webapi', 'net10-blazor-wasm', 'net9-blazor-wasm']) {
    if (caseIds.has(banned)) {
      errors.push(`DOTNET_COVERAGE_FORBIDDEN_PRODUCT_LINE: ${banned} in Lab Full (Veracode framework limit)`);
    }
  }

  if (contract.artifactTypes?.notProductized?.includes('nupkg')) {
    const nupkgCase = cases.find((c) => /nupkg/i.test(c.case) || /nupkg/i.test(c.scenario || ''));
    if (nupkgCase) {
      errors.push(`DOTNET_COVERAGE_FORBIDDEN_PRODUCT_LINE: NUPKG case ${nupkgCase.case}`);
    }
  }

  const report = [
    '# .NET Modern Coverage Contract',
    '',
    `| Metric | Count |`,
    `| --- | ---: |`,
    `| Declared runtimes | ${(contract.declaredRuntimes || []).length} |`,
    `| Project type rules | ${(contract.projectTypes || []).length} |`,
    `| Lab Full .NET modern cases | ${cases.length} |`,
    '',
    errors.length ? 'Result: FAIL' : 'Result: PASS',
    ...errors.map((e) => `- ${e}`)
  ].join('\n');

  console.log(report);
  if (errors.length) process.exit(1);
}

main();
