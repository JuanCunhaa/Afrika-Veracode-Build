'use strict';

/**
 * Ensures untrusted CI (ci.yml) never references Lab App / Veracode secrets,
 * and that only trusted orchestrator workflows may reference LAB_GITHUB_APP_*.
 *
 * Exit 1 on violation.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const WORKFLOWS = path.join(ROOT, '.github', 'workflows');

const FORBIDDEN_IN_CI = [
  'LAB_GITHUB_APP_PRIVATE_KEY',
  'LAB_GITHUB_APP_ID',
  'LAB_GITHUB_APP_INSTALLATION_ID',
  'VERACODE_API_KEY',
  'VERACODE_API_ID'
];

const LAB_APP_SECRETS = ['LAB_GITHUB_APP_PRIVATE_KEY', 'LAB_GITHUB_APP_ID', 'LAB_GITHUB_APP_INSTALLATION_ID'];

/** Trusted workflows that may dispatch Lab / Veracode via GitHub App (never PR-owned). */
const TRUSTED_LAB_ORCHESTRATORS = new Set(['lab-orchestrator.yml', 'product-gate.yml', 'release-certification.yml']);

function read(rel) {
  return fs.readFileSync(path.join(WORKFLOWS, rel), 'utf8');
}

function main() {
  const errors = [];
  const ci = read('ci.yml');
  for (const secret of FORBIDDEN_IN_CI) {
    if (ci.includes(secret)) {
      errors.push(`ci.yml must not reference ${secret}`);
    }
  }

  const files = fs.readdirSync(WORKFLOWS).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
  for (const f of files) {
    if (TRUSTED_LAB_ORCHESTRATORS.has(f)) continue;
    const body = read(f);
    for (const secret of LAB_APP_SECRETS) {
      if (body.includes(secret)) {
        errors.push(
          `${f} must not reference ${secret} (only trusted orchestrators: ${[...TRUSTED_LAB_ORCHESTRATORS].join(', ')})`
        );
      }
    }
    for (const secret of ['VERACODE_API_KEY', 'VERACODE_API_ID']) {
      if (body.includes(secret)) {
        errors.push(`${f} must not reference ${secret} (Veracode secrets stay in Lab environment)`);
      }
    }
  }

  const orch = read('lab-orchestrator.yml');
  if (!orch.includes('LAB_GITHUB_APP_PRIVATE_KEY')) {
    errors.push('lab-orchestrator.yml should reference LAB_GITHUB_APP_PRIVATE_KEY');
  }

  if (errors.length) {
    console.error('WORKFLOW_SECRET_POLICY_FAILED');
    for (const e of errors) console.error(`- ${e}`);
    process.exit(1);
  }
  console.log('check-workflow-secret-policy: ok');
}

main();
