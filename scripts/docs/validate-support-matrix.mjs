#!/usr/bin/env node
/**
 * Bidirectional support completeness (Action-side structural checks).
 *
 * Codes:
 *   SUPPORT_MATRIX_LAB_COVERAGE_MISSING
 *   SUPPORT_MATRIX_VERACODE_COVERAGE_MISSING
 *   SUPPORT_MATRIX_ORPHAN_CASE
 *   CERTIFICATION_STATUS_NOT_GENERATED
 *   EVENT_POLICY_INVALID
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  ACTION_ROOT,
  assertCertificationGenerated,
  buildPipelineCasesFromSupport,
  countReleaseVeracodeFull,
  countDeclaredLabCompatibilityCases,
  getRequiredVeracodeCases,
  loadCertificationStatus,
  loadEventPolicy,
  loadSupportMatrix
} from './support-matrix-lib.mjs';

const CODE = 'SUPPORT_MATRIX_VALIDATION_FAILED';

function main() {
  /** @type {string[]} */
  const errors = [];

  const support = loadSupportMatrix();
  const cert = loadCertificationStatus();
  const policy = loadEventPolicy();

  try {
    assertCertificationGenerated(cert);
  } catch (e) {
    errors.push(String(e.message || e));
  }

  const ids = new Set();
  for (const row of support.rows || []) {
    if (!row.id) errors.push('support row missing id');
    if (ids.has(row.id)) errors.push(`duplicate support id: ${row.id}`);
    ids.add(row.id);

    if (!row.capability) errors.push(`${row.id}: missing capability`);
    if (!row.technology) errors.push(`${row.id}: missing technology`);

    if (row.releaseEligible && row.declaredLifecycle === 'planned') {
      errors.push(`${row.id}: planned cannot be releaseEligible`);
    }

    if (row.veracodeCertificationRequired) {
      const cases = getRequiredVeracodeCases(row);
      if (!cases.length) {
        errors.push(
          `SUPPORT_MATRIX_VERACODE_COVERAGE_MISSING: ${row.id} requires ≥1 veracodeCertification.cases entry`
        );
      }
      for (const c of cases) {
        if (!c.contractCase || !c.fixture || !c.family) {
          errors.push(`SUPPORT_MATRIX_VERACODE_COVERAGE_MISSING: ${row.id}/${c.id} incomplete case mapping`);
        }
      }
      if (!row.lab?.primaryCase) {
        errors.push(`SUPPORT_MATRIX_LAB_COVERAGE_MISSING: ${row.id} requires lab.primaryCase`);
      }
    }

    if (row.declaredLifecycle === 'beta' || row.declaredLifecycle === 'stable') {
      if (!row.lab?.primaryCase) {
        errors.push(`SUPPORT_MATRIX_LAB_COVERAGE_MISSING: ${row.id} beta/stable needs lab primaryCase`);
      }
      // Declaring beta/stable with Veracode required must list certification cases (fail early for new versions)
      if (row.veracodeCertificationRequired !== false && row.releaseEligible) {
        if (!getRequiredVeracodeCases(row).length) {
          errors.push(
            `SUPPORT_MATRIX_VERACODE_COVERAGE_MISSING: ${row.id} releaseEligible beta/stable missing certification cases`
          );
        }
      }
    }

    // compatibilityCases when present must include primaryCase
    if (row.lab?.compatibilityCases && row.lab.primaryCase) {
      if (!row.lab.compatibilityCases.includes(row.lab.primaryCase)) {
        errors.push(`SUPPORT_MATRIX_LAB_COVERAGE_MISSING: ${row.id} lab.compatibilityCases must include primaryCase`);
      }
    }
  }

  const releaseFull = countReleaseVeracodeFull();
  const expectedFull = support.veracodeProfiles?.full?.expectedCaseCount;
  if (expectedFull !== 40) {
    errors.push(
      `SUPPORT_MATRIX_VERACODE_COVERAGE_MISSING: veracodeProfiles.full.expectedCaseCount must be 40 (Lab Compatibility Full), got ${expectedFull}`
    );
  }
  if (releaseFull !== 40) {
    errors.push(`SUPPORT_MATRIX_VERACODE_COVERAGE_MISSING: countReleaseVeracodeFull() must be 40, got ${releaseFull}`);
  }
  const labDeclared = countDeclaredLabCompatibilityCases();
  if (labDeclared !== 40) {
    errors.push(
      `SUPPORT_MATRIX_LAB_COVERAGE_MISSING: declared lab.compatibilityCases unique count must be 40, got ${labDeclared}`
    );
  }
  // Packaging variants still required for public-row Veracode ✅ (subset of Lab full)
  const certVariants = buildPipelineCasesFromSupport(ACTION_ROOT, 'full');
  if (certVariants.length < 14) {
    errors.push(
      `SUPPORT_MATRIX_VERACODE_COVERAGE_MISSING: packaging certification variants ${certVariants.length} look incomplete (expected ≥14)`
    );
  }

  const requiredEvents = [
    'push_non_main',
    'pull_request_to_main',
    'merge_group',
    'push_main',
    'release_candidate',
    'workflow_dispatch'
  ];
  for (const key of requiredEvents) {
    if (!policy.events?.[key]) errors.push(`EVENT_POLICY_INVALID: missing events.${key}`);
  }

  if (policy.events?.push_main?.veracode !== 'representative') {
    errors.push('EVENT_POLICY_INVALID: push_main.veracode must be representative');
  }
  if (policy.events?.release_candidate?.veracode !== 'full') {
    errors.push('EVENT_POLICY_INVALID: release_candidate.veracode must be full');
  }
  if (policy.events?.pull_request_to_main?.veracode !== 'none') {
    errors.push('EVENT_POLICY_INVALID: pull_request_to_main.veracode must be none');
  }

  const capsPath = path.join(ACTION_ROOT, 'schemas/capabilities.json');
  const caps = JSON.parse(fs.readFileSync(capsPath, 'utf8'));
  for (const row of support.rows || []) {
    if (!caps.capabilities?.[row.capability]) {
      errors.push(`${row.id}: capability ${row.capability} missing from capabilities.json`);
    }
  }

  const repCases = buildPipelineCasesFromSupport(ACTION_ROOT, 'representative');
  const report = [
    '# Support Matrix Validation',
    '',
    `| Metric | Count |`,
    `| --- | ---: |`,
    `| Declared support rows | ${(support.rows || []).length} |`,
    `| Release Veracode full (= Lab Compatibility Full) | ${releaseFull} |`,
    `| Declared Lab compatibility cases | ${labDeclared} |`,
    `| Packaging certification variants (row ✅) | ${certVariants.length} |`,
    `| Veracode representative cases | ${repCases.length} |`,
    '',
    'profile=full Pipeline Scan = all 40 Lab Compatibility Full cases.',
    '',
    errors.length ? `Result: ${CODE}` : 'Result: PASS',
    ...errors.map((e) => `- ${e}`)
  ].join('\n');

  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);
  }
  if (errors.length) {
    console.error(`::error title=${CODE}::${errors.length} support-matrix issue(s)`);
    process.exit(1);
  }
}

main();
