'use strict';

/**
 * Feature Completeness validator — Action Completeness only.
 *
 * Compares schemas/capabilities.json with Action-local discovery/builder/doctor/
 * unit/negative/docs. Integration fixtures, golden artifacts, contract cases on
 * disk, and test-matrix.json live in Afrika-Veracode-Build-Lab and are declared
 * via labValidation (keys required; Lab paths are not checked here).
 *
 * Uso:
 *   node tests/security/check-feature-completeness.js
 *   npm run check:completeness
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const CAPABILITIES_PATH = path.join(ROOT, 'schemas/capabilities.json');
const DOCTOR_INDEX = path.join(ROOT, 'internal/doctor/index.js');
const README = path.join(ROOT, 'README.md');
const VERACODE_PACKAGING = path.join(ROOT, 'docs/VERACODE-PACKAGING.md');

const CODE = 'FEATURE_COMPLETENESS_FAILED';

const LAB_VALIDATION_KEYS = [
  'required',
  'integrationSuite',
  'contractSuite',
  'goldenSuite',
  'matrixKey',
  'veracodeE2E'
];

/**
 * @param {string} rel
 * @returns {string}
 */
function abs(rel) {
  return path.join(ROOT, rel);
}

/**
 * @param {string} p
 * @returns {boolean}
 */
function exists(p) {
  return fs.existsSync(p);
}

/**
 * @param {string} dir
 * @returns {boolean}
 */
function hasAnyTestFile(dir) {
  if (!exists(dir)) return false;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    for (const ent of fs.readdirSync(cur, { withFileTypes: true })) {
      const full = path.join(cur, ent.name);
      if (ent.isDirectory()) stack.push(full);
      else if (ent.isFile() && ent.name.endsWith('.test.js')) return true;
    }
  }
  return false;
}

/**
 * @returns {Set<string>}
 */
function loadDoctorRegistryKeys() {
  const text = fs.readFileSync(DOCTOR_INDEX, 'utf8');
  const keys = new Set();
  const re = /['"]([a-z0-9-]+)['"]\s*:/g;
  let m;
  const block = text.match(/const REGISTRY\s*=\s*\{([\s\S]*?)\};/);
  if (!block) return keys;
  const inner = block[1];
  while ((m = re.exec(inner))) {
    keys.add(m[1]);
  }
  return keys;
}

/**
 * Validate labValidation object declares required logical keys (not Lab FS paths).
 * @param {object|undefined} lab
 * @returns {string[]}
 */
function validateLabValidationDecl(lab) {
  const missing = [];
  if (!lab || typeof lab !== 'object') {
    missing.push('labValidation required for beta/stable');
    return missing;
  }
  for (const key of LAB_VALIDATION_KEYS) {
    if (!(key in lab)) missing.push(`labValidation.${key} missing`);
  }
  if (lab.required !== true && lab.required !== false) {
    missing.push('labValidation.required must be boolean');
  }
  if (typeof lab.veracodeE2E !== 'boolean') {
    missing.push('labValidation.veracodeE2E must be boolean');
  }
  for (const key of ['integrationSuite', 'contractSuite', 'goldenSuite', 'matrixKey']) {
    if (key in lab && (lab[key] == null || String(lab[key]).trim() === '')) {
      missing.push(`labValidation.${key} must be non-empty`);
    }
  }
  return missing;
}

/**
 * @param {string} id
 * @param {object} cap
 * @param {Set<string>} doctorKeys
 * @param {string} readme
 * @param {string} packagingDoc
 * @returns {string[]}
 */
function validateCapability(id, cap, doctorKeys, readme, packagingDoc) {
  const missing = [];
  const status = cap.status;

  if (!['planned', 'experimental', 'beta', 'stable'].includes(status)) {
    missing.push(`invalid status "${status}"`);
    return missing;
  }

  if (status === 'planned') {
    return missing;
  }

  // experimental: if a path is declared, it must exist; undeclared gaps are OK
  if (status === 'experimental') {
    if (cap.discoveryDetector && !exists(abs(cap.discoveryDetector))) {
      missing.push(`discoveryDetector missing: ${cap.discoveryDetector}`);
    }
    if (cap.builderPath && !exists(abs(cap.builderPath))) {
      missing.push(`builderPath missing: ${cap.builderPath}`);
    }
    if (cap.doctorModule && !exists(abs(cap.doctorModule))) {
      missing.push(`doctorModule missing: ${cap.doctorModule}`);
    }
    return missing;
  }

  // beta + stable: Action-local contract
  if (cap.discoveryDetector) {
    if (!exists(abs(cap.discoveryDetector))) missing.push(`Discovery detector: ${cap.discoveryDetector}`);
  } else {
    missing.push('discoveryDetector required for beta/stable');
  }

  if (cap.packagingRequired || cap.buildRequired) {
    if (!cap.builderPath || !exists(abs(cap.builderPath))) {
      missing.push(`Builder/Packager path: ${cap.builderPath || '(unset)'}`);
    }
  }

  if (!cap.doctorModule || !exists(abs(cap.doctorModule))) {
    missing.push(`Doctor module: ${cap.doctorModule || '(unset)'}`);
  }

  for (const profile of cap.doctorProfiles || []) {
    if (!doctorKeys.has(profile)) missing.push(`Doctor profile not registered: ${profile}`);
  }

  const unitRoots = cap.unitGlobs || [];
  if (unitRoots.length === 0) missing.push('unitGlobs empty');
  for (const rel of unitRoots) {
    if (!hasAnyTestFile(abs(rel))) missing.push(`Unit tests missing/empty under ${rel}`);
  }

  if (cap.negativeRequired) {
    const negDoctor = abs('tests/negative/doctor');
    const negDisc = abs('tests/negative/discovery');
    if (!hasAnyTestFile(negDoctor) && !hasAnyTestFile(negDisc)) {
      missing.push('Negative tests required (tests/negative/doctor or discovery)');
    }
  }

  // contractFamily is a logical id for docs / Lab mapping — do not require local cases.json
  if (!cap.contractFamily) {
    missing.push('contractFamily required for beta/stable (logical id for Lab contract suite)');
  }

  missing.push(...validateLabValidationDecl(cap.labValidation));

  if (cap.actionValidation) {
    if (typeof cap.actionValidation !== 'object') {
      missing.push('actionValidation must be an object');
    }
  }

  if (cap.veracodePackagingSection) {
    if (!packagingDoc.includes(cap.veracodePackagingSection)) {
      missing.push(`docs/VERACODE-PACKAGING.md missing section hint: ${cap.veracodePackagingSection}`);
    }
  }

  if (cap.readmeRow) {
    if (!readme.includes(cap.readmeRow)) {
      missing.push(`README.md missing technology row: ${cap.readmeRow}`);
    }
  }

  if (status === 'stable') {
    // Evidence lives in Lab (e2e/veracode). Action only requires the flag.
    if (!cap.veracodeE2E) {
      missing.push('veracodeE2E must be true for status=stable (evidence lives in Lab)');
    }
    if (cap.labValidation && cap.labValidation.veracodeE2E !== true) {
      missing.push('labValidation.veracodeE2E must be true for status=stable');
    }
  }

  if (cap.veracodeE2E === true && status !== 'stable' && status !== 'beta') {
    missing.push('veracodeE2E=true inconsistent with status (expected beta/stable)');
  }

  return missing;
}

/**
 * @returns {{ ok: boolean, report: string, failures: object[] }}
 */
function runCheck() {
  const capsDoc = JSON.parse(fs.readFileSync(CAPABILITIES_PATH, 'utf8'));
  const doctorKeys = loadDoctorRegistryKeys();
  const readme = fs.readFileSync(README, 'utf8');
  const packagingDoc = exists(VERACODE_PACKAGING) ? fs.readFileSync(VERACODE_PACKAGING, 'utf8') : '';

  const failures = [];
  const lines = [
    '# Feature Completeness Report (Action)',
    '',
    'Integration / contract / golden / matrix / Veracode E2E evidence are validated in Lab.',
    '',
    `| Capability | Status | Result |`,
    `| --- | --- | --- |`
  ];

  for (const [id, cap] of Object.entries(capsDoc.capabilities || {})) {
    const missing = validateCapability(id, cap, doctorKeys, readme, packagingDoc);
    if (missing.length) {
      failures.push({ id, status: cap.status, missing });
      lines.push(`| ${id} | ${cap.status} | FAIL |`);
    } else {
      lines.push(`| ${id} | ${cap.status} | PASS |`);
    }
  }

  if (failures.length) {
    lines.push('', '## Failures', '');
    for (const f of failures) {
      lines.push(`### ${f.id} (${f.status})`);
      for (const m of f.missing) lines.push(`- ${m}`);
      lines.push('');
    }
  }

  lines.push('', failures.length ? `Result: ${CODE}` : 'Result: PASS');
  return { ok: failures.length === 0, report: lines.join('\n'), failures };
}

function main() {
  const { ok, report, failures } = runCheck();
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);
  }
  if (!ok) {
    console.error(`::error title=${CODE}::Feature completeness failed (${failures.length} capability issue(s))`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  runCheck,
  validateCapability,
  validateLabValidationDecl,
  CAPABILITIES_PATH,
  CODE
};
