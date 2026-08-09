'use strict';

/**
 * Ensures untrusted CI (ci.yml) never references Lab App / Veracode secrets,
 * and that only lab-orchestrator.yml may reference LAB_GITHUB_APP_*.
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

const LAB_APP_SECRETS = [
  'LAB_GITHUB_APP_PRIVATE_KEY',
  'LAB_GITHUB_APP_ID',
  'LAB_GITHUB_APP_INSTALLATION_ID'
];

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
    if (f === 'lab-orchestrator.yml') continue;
    const body = read(f);
    for (const secret of LAB_APP_SECRETS) {
      if (body.includes(secret)) {
        errors.push(`${f} must not reference ${secret} (only lab-orchestrator.yml may)`);
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
