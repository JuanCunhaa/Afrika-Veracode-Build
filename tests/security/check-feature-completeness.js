'use strict';

/**
 * Feature Completeness validator.
 *
 * Compara schemas/capabilities.json com arquivos/testes/matrix reais.
 * Falha com FEATURE_COMPLETENESS_FAILED se status beta/stable declarar suporte incompleto.
 *
 * Uso:
 *   node tests/security/check-feature-completeness.js
 *   npm run check:completeness
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const CAPABILITIES_PATH = path.join(ROOT, 'schemas/capabilities.json');
const TEST_MATRIX_PATH = path.join(ROOT, 'tests/test-matrix.json');
const DOCTOR_INDEX = path.join(ROOT, 'internal/doctor/index.js');
const README = path.join(ROOT, 'README.md');
const VERACODE_PACKAGING = path.join(ROOT, 'docs/VERACODE-PACKAGING.md');
const E2E_EVIDENCE_DIR = path.join(ROOT, 'tests/e2e/veracode');

const CODE = 'FEATURE_COMPLETENESS_FAILED';

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
 * @param {string} family
 * @returns {{ ok: boolean, cases: number }}
 */
function contractCases(family) {
  const p = abs(`tests/contract/builder-doctor/${family}/cases.json`);
  if (!exists(p)) return { ok: false, cases: 0 };
  try {
    const arr = JSON.parse(fs.readFileSync(p, 'utf8'));
    return { ok: Array.isArray(arr) && arr.length > 0, cases: Array.isArray(arr) ? arr.length : 0 };
  } catch {
    return { ok: false, cases: 0 };
  }
}

/**
 * @returns {Set<string>}
 */
function loadDoctorRegistryKeys() {
  const text = fs.readFileSync(DOCTOR_INDEX, 'utf8');
  const keys = new Set();
  const re = /['"]([a-z0-9-]+)['"]\s*:/g;
  let m;
  // crude: only inside REGISTRY object — accept known profile pattern
  const block = text.match(/const REGISTRY\s*=\s*\{([\s\S]*?)\};/);
  if (!block) return keys;
  const inner = block[1];
  while ((m = re.exec(inner))) {
    keys.add(m[1]);
  }
  return keys;
}

/**
 * @param {string} rootRel
 * @returns {boolean}
 */
function hasFixtureContent(rootRel) {
  const root = abs(rootRel);
  if (!exists(root)) return false;
  // at least one nested file beyond .gitkeep
  const stack = [root];
  while (stack.length) {
    const cur = stack.pop();
    for (const ent of fs.readdirSync(cur, { withFileTypes: true })) {
      const full = path.join(cur, ent.name);
      if (ent.isDirectory()) stack.push(full);
      else if (ent.isFile() && ent.name !== '.gitkeep' && ent.name !== 'README.md') return true;
    }
  }
  return false;
}

/**
 * @param {object} cap
 * @param {object} matrix
 * @param {Set<string>} doctorKeys
 * @param {string} readme
 * @param {string} packagingDoc
 * @returns {string[]}
 */
function validateCapability(id, cap, matrix, doctorKeys, readme, packagingDoc) {
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

  // beta + stable: full applicable contract
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

  if (cap.contractFamily) {
    const cc = contractCases(cap.contractFamily);
    if (!cc.ok)
      missing.push(`Builder→Doctor contract cases: tests/contract/builder-doctor/${cap.contractFamily}/cases.json`);
  } else {
    missing.push('contractFamily required for beta/stable');
  }

  if (cap.integrationFixtureRoot) {
    if (!hasFixtureContent(cap.integrationFixtureRoot)) {
      missing.push(`Integration fixtures: ${cap.integrationFixtureRoot}`);
    }
  } else {
    missing.push('integrationFixtureRoot required for beta/stable');
  }

  if (cap.goldenArtifactsRoot) {
    if (!exists(abs(cap.goldenArtifactsRoot))) {
      missing.push(`Golden artifacts root: ${cap.goldenArtifactsRoot}`);
    }
  } else {
    missing.push('goldenArtifactsRoot required for beta/stable');
  }

  if (cap.testMatrixKey) {
    const rows = matrix[cap.testMatrixKey];
    if (!Array.isArray(rows) || rows.length === 0) {
      missing.push(`Test matrix key empty: ${cap.testMatrixKey}`);
    } else {
      const inFull = rows.some((r) => Array.isArray(r.profiles) && r.profiles.includes('full'));
      if (!inFull) missing.push(`Test matrix ${cap.testMatrixKey}: no profile "full" entries`);
    }
  } else {
    missing.push('testMatrixKey required for beta/stable');
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
    if (!cap.veracodeE2E) {
      missing.push('veracodeE2E must be true for status=stable');
    }
    const evidence = path.join(E2E_EVIDENCE_DIR, id, 'RESULT.md');
    if (!exists(evidence)) {
      missing.push(`Veracode E2E evidence missing: tests/e2e/veracode/${id}/RESULT.md`);
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
  const matrix = JSON.parse(fs.readFileSync(TEST_MATRIX_PATH, 'utf8'));
  const doctorKeys = loadDoctorRegistryKeys();
  const readme = fs.readFileSync(README, 'utf8');
  const packagingDoc = exists(VERACODE_PACKAGING) ? fs.readFileSync(VERACODE_PACKAGING, 'utf8') : '';

  const failures = [];
  const lines = ['# Feature Completeness Report', '', `| Capability | Status | Result |`, `| --- | --- | --- |`];

  for (const [id, cap] of Object.entries(capsDoc.capabilities || {})) {
    const missing = validateCapability(id, cap, matrix, doctorKeys, readme, packagingDoc);
    if (missing.length) {
      failures.push({ id, status: cap.status, missing });
      lines.push(`| ${id} | ${cap.status} | FAIL |`);
    } else {
      lines.push(`| ${id} | ${cap.status} | PASS |`);
    }
  }

  // Cross-check: matrix keys used by beta/stable must be declared in capabilities
  const declaredMatrixKeys = new Set(
    Object.values(capsDoc.capabilities || {})
      .map((c) => c.testMatrixKey)
      .filter(Boolean)
  );
  for (const key of ['javaMaven', 'javaGradle', 'javascript', 'typescript', 'dotnetModern', 'dotnetFramework']) {
    if (Array.isArray(matrix[key]) && matrix[key].length && !declaredMatrixKeys.has(key)) {
      failures.push({
        id: `matrix:${key}`,
        status: 'n/a',
        missing: [`test-matrix.json key ${key} has cases but no capabilities.json entry owns it`]
      });
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
  CAPABILITIES_PATH,
  CODE
};
