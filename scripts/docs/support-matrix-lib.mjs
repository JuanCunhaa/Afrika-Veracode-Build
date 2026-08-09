/**
 * Support matrix + certification status helpers (deterministic).
 * README is OUTPUT — never the source of truth.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ACTION_ROOT = path.resolve(__dirname, '../..');

export const MARKERS = Object.freeze({
  START: '<!-- SUPPORT_MATRIX:START -->',
  END: '<!-- SUPPORT_MATRIX:END -->',
  AUTO_COMMENT: '<!--\nEsta seção é gerada automaticamente.\nNão editar manualmente.\n-->'
});

export const STATUS_ICONS = Object.freeze({
  pass: '✅',
  beta: '🧪',
  pending: '⏳',
  fail: '❌',
  na: '—'
});

/**
 * @param {string} filePath
 */
export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * @param {unknown} value
 */
export function stableStringify(value) {
  return JSON.stringify(value, Object.keys(sortKeys(value)).length ? undefined : undefined);
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value).sort()) out[k] = sortKeys(value[k]);
    return out;
  }
  return value;
}

/**
 * @param {unknown} value
 */
export function fingerprint(value) {
  const canonical = JSON.stringify(sortKeys(value));
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/**
 * @param {string} [root]
 */
export function loadSupportMatrix(root = ACTION_ROOT) {
  return readJson(path.join(root, 'schemas/support-matrix.json'));
}

/**
 * @param {string} [root]
 */
export function loadCertificationStatus(root = ACTION_ROOT) {
  return readJson(path.join(root, 'schemas/certification-status.json'));
}

/**
 * @param {string} [root]
 */
export function loadEventPolicy(root = ACTION_ROOT) {
  return readJson(path.join(root, 'schemas/event-policy.json'));
}

/**
 * Required Veracode Pipeline Scan cases for a support row.
 * Prefers veracodeCertification.cases[]; falls back to legacy single `veracode`.
 * @param {object} row
 * @returns {object[]}
 */
export function getRequiredVeracodeCases(row) {
  if (!row) return [];
  if (row.veracodeCertification && Array.isArray(row.veracodeCertification.cases)) {
    if (row.veracodeCertification.required === false && !row.veracodeCertificationRequired) {
      return [];
    }
    return row.veracodeCertification.cases.filter((c) => c && c.required !== false);
  }
  if (row.veracodeCertificationRequired && row.veracode) {
    return [
      {
        id: row.id,
        variant: 'primary',
        required: true,
        representative: !!row.representative,
        ...row.veracode
      }
    ];
  }
  return [];
}

/**
 * @param {object} row
 * @param {object|undefined} evidence
 * @returns {boolean}
 */
export function allRequiredVeracodeCasesPassed(row, evidence) {
  const required = getRequiredVeracodeCases(row);
  if (!required.length) return false;
  const caseMap = evidence?.veracodeCases || {};
  return required.every((c) => {
    const status = caseMap[c.id];
    return status === 'pass' || status === 'PASS';
  });
}

/**
 * Resolve public cell + overall status for one declared row + optional evidence.
 * Veracode ✅ only when EVERY required certification case for the row passed.
 * @param {object} row
 * @param {object|undefined} evidence
 */
export function resolveRowStatus(row, evidence) {
  const declared = row.declaredLifecycle || 'planned';

  if (declared === 'planned') {
    return {
      discovery: STATUS_ICONS.pending,
      builder: STATUS_ICONS.pending,
      doctor: STATUS_ICONS.pending,
      veracode: STATUS_ICONS.pending,
      status: 'Planejado',
      statusKey: 'planned',
      validatedRealVeracode: false
    };
  }

  if (declared === 'experimental' && !row.lab) {
    return {
      discovery: STATUS_ICONS.beta,
      builder: STATUS_ICONS.fail,
      doctor: STATUS_ICONS.fail,
      veracode: STATUS_ICONS.pending,
      status: 'Experimental',
      statusKey: 'experimental',
      validatedRealVeracode: false
    };
  }

  const discovery = evidence?.discovery === 'pass' || evidence?.validatedLab === true;
  const builder = evidence?.builder === 'pass' || evidence?.validatedLab === true;
  const doctor = evidence?.doctor === 'pass' || evidence?.validatedLab === true;

  const requiredCases = getRequiredVeracodeCases(row);
  const casesAllPass = allRequiredVeracodeCasesPassed(row, evidence);
  const legacyAggregate =
    requiredCases.length === 0
      ? false
      : evidence?.validatedRealVeracode === true &&
        evidence?.veracodePipelineScan === 'pass' &&
        (!evidence?.veracodeCases || Object.keys(evidence.veracodeCases).length === 0);
  const veracodeReal = casesAllPass || legacyAggregate;

  const certFingerprintPayload = {
    id: row.id,
    capability: row.capability,
    version: row.version,
    veracodeCertification: row.veracodeCertification || row.veracode || null,
    lab: row.lab
  };

  // Stale: evidence fingerprint mismatch with current support row definition
  const stale =
    evidence?.supportRowFingerprint && evidence.supportRowFingerprint !== fingerprint(certFingerprintPayload);

  const veracodePass = veracodeReal && !stale;

  let statusKey = declared;
  let statusLabel =
    declared === 'experimental'
      ? 'Experimental'
      : declared === 'beta'
        ? 'Beta'
        : declared === 'stable'
          ? 'Stable'
          : declared;

  if (discovery && builder && doctor && veracodePass) {
    statusKey = 'stable';
    statusLabel = 'Stable';
  } else if (discovery && builder && doctor && !veracodePass) {
    statusKey = 'beta';
    statusLabel = 'Beta';
  } else if (declared === 'experimental') {
    statusKey = 'experimental';
    statusLabel = 'Experimental';
  } else if (!discovery && !builder && !doctor) {
    // Declared beta without lab evidence yet → show experimental/beta cells as in validation
    statusKey = declared === 'experimental' ? 'experimental' : 'beta';
    statusLabel = declared === 'experimental' ? 'Experimental' : 'Beta';
  }

  const cell = (ok, experimentalHint) => {
    if (ok) return STATUS_ICONS.pass;
    if (experimentalHint || declared === 'experimental') return STATUS_ICONS.beta;
    return STATUS_ICONS.beta;
  };

  return {
    discovery: cell(discovery, declared === 'experimental'),
    builder: cell(builder, declared === 'experimental'),
    doctor: cell(doctor, declared === 'experimental'),
    veracode: veracodePass ? STATUS_ICONS.pass : STATUS_ICONS.pending,
    status: statusLabel,
    statusKey,
    validatedRealVeracode: veracodePass,
    stale: !!stale
  };
}

/**
 * Build markdown table block (between markers).
 * @param {{ support?: object, cert?: object }} [opts]
 */
export function generateSupportMatrixMarkdown(opts = {}) {
  const support = opts.support || loadSupportMatrix();
  const cert = opts.cert || loadCertificationStatus();
  const evidenceRows = cert.rows || {};

  const lines = [
    MARKERS.AUTO_COMMENT,
    '',
    'Matriz referente à última certificação publicada (quando existir).',
    'Cobertura = **100% da matriz de suporte oficialmente declarada** — não “qualquer aplicação do mundo”.',
    '',
    '| Tecnologia | Versão | Discovery | Builder | Doctor | Veracode | Status |',
    '| --- | --- | ---: | ---: | ---: | ---: | --- |'
  ];

  for (const row of support.rows || []) {
    const resolved = resolveRowStatus(row, evidenceRows[row.id]);
    lines.push(
      `| ${row.technology} | ${row.version} | ${resolved.discovery} | ${resolved.builder} | ${resolved.doctor} | ${resolved.veracode} | ${resolved.status} |`
    );
  }

  lines.push(
    '',
    '**Legenda**',
    '',
    '- ✅ Validado',
    '- 🧪 Em validação / Beta / Experimental',
    '- ⏳ Ainda não certificado',
    '- ❌ Não suportado / não implementado',
    '',
    '**Veracode** = validação realizada através do Veracode Pipeline Scan (Static Analysis).',
    'Uma linha só recebe Veracode ✅ quando **todos** os casos de certificação obrigatórios daquela linha passam (ex.: JAR e WAR).',
    'Não inclui SCA, Upload & Scan, Sandbox, DAST ou outros produtos Veracode.',
    '',
    '**Builder** inclui preparação/empacotamento de código-fonte (ex.: JavaScript/TypeScript), mesmo quando não há compilação tradicional.',
    '',
    '**Como validamos o suporte**',
    '',
    'Uma tecnologia só é considerada **Stable** após passar por Discovery, preparação do artifact, Doctor e validação real através do Veracode Pipeline Scan.'
  );

  if (cert.release || cert.sourceSha) {
    lines.push(
      '',
      `Última certificação: \`${cert.release || '—'}\` · SHA \`${cert.sourceSha || '—'}\`${cert.certifiedAt ? ` · ${cert.certifiedAt}` : ''}.`
    );
  } else {
    lines.push('', 'Nenhuma release ainda foi certificada com Pipeline Scan real nesta árvore de evidências.');
  }

  return lines.join('\n');
}

/**
 * @param {string} readme
 * @param {string} block
 */
export function applySupportMatrixBlock(readme, block) {
  const start = readme.indexOf(MARKERS.START);
  const end = readme.indexOf(MARKERS.END);
  if (start < 0 || end < 0 || end < start) {
    throw new Error('README.md missing SUPPORT_MATRIX markers');
  }
  const before = readme.slice(0, start + MARKERS.START.length);
  const after = readme.slice(end);
  return `${before}\n${block}\n${after}`;
}

/**
 * Build Pipeline Scan cases from declared support (derived — not a hand-maintained full=10 list).
 * @param {string} [root]
 * @param {'representative'|'full'|null} [profile] when set, filter by profile membership
 */
export function buildPipelineCasesFromSupport(root = ACTION_ROOT, profile = null) {
  const support = loadSupportMatrix(root);
  /** @type {object[]} */
  const cases = [];

  for (const row of support.rows || []) {
    if (!row.releaseEligible || !row.veracodeCertificationRequired) continue;
    const certCases = getRequiredVeracodeCases(row);
    for (const c of certCases) {
      const profiles = ['full'];
      if (c.representative) profiles.unshift('representative');
      if (profile && !profiles.includes(profile)) continue;
      cases.push({
        id: c.id,
        supportRowId: row.id,
        variant: c.variant || 'primary',
        profiles,
        capability: row.capability,
        family: c.family,
        contractCase: c.contractCase,
        fixture: c.fixture,
        buildOs: c.buildOs || 'ubuntu-latest',
        setup: c.setup,
        scenario: c.scenario,
        required: c.required !== false
      });
    }
  }

  // Legacy extras (pre schemaVersion 2) — representative only
  for (const extra of support.extraRepresentativeCases || []) {
    const profiles = extra.profiles || ['representative'];
    if (profile && !profiles.includes(profile)) continue;
    if (cases.some((c) => c.id === extra.id)) continue;
    cases.push({
      id: extra.id,
      supportRowId: extra.supportRowId,
      variant: extra.variant || 'extra',
      profiles,
      capability: extra.capability,
      family: extra.family,
      contractCase: extra.contractCase,
      fixture: extra.fixture,
      buildOs: extra.buildOs,
      setup: extra.setup,
      scenario: extra.scenario,
      extra: true,
      required: false
    });
  }

  return cases;
}

/**
 * Expected Pipeline Scan case count for release profile=full.
 * Source of truth: Lab Compatibility Full (all cases), declared on support-matrix.
 * @param {string} [root]
 */
export function countReleaseVeracodeFull(root = ACTION_ROOT) {
  const support = loadSupportMatrix(root);
  const declared = support.veracodeProfiles?.full?.expectedCaseCount;
  if (typeof declared === 'number' && declared > 0) return declared;
  // Legacy fallback: certification variants (obsolete once veracodeProfiles.full is set)
  return buildPipelineCasesFromSupport(root, 'full').filter((c) => c.required !== false).length;
}

/**
 * Unique Lab compatibility cases referenced by declared support rows (full profile).
 * @param {string} [root]
 */
export function countDeclaredLabCompatibilityCases(root = ACTION_ROOT) {
  const support = loadSupportMatrix(root);
  /** @type {Set<string>} */
  const ids = new Set();
  for (const row of support.rows || []) {
    if (!row.lab?.matrixKey) continue;
    const cases = row.lab.compatibilityCases?.length
      ? row.lab.compatibilityCases
      : row.lab.primaryCase
        ? [row.lab.primaryCase]
        : [];
    for (const c of cases) ids.add(`${row.lab.matrixKey}/${c}`);
  }
  return ids.size;
}

/**
 * @param {object} policy
 * @param {string} eventKey
 */
export function resolveEventPolicy(policy, eventKey) {
  const events = policy.events || {};
  if (!events[eventKey]) {
    throw new Error(`Unknown event policy key: ${eventKey}`);
  }
  return events[eventKey];
}

/**
 * Docs-only path filter (no bypass when code changes).
 * @param {string[]} changedFiles
 * @param {object} policy
 */
export function isDocsOnlyChange(changedFiles, policy) {
  const allowed = policy.docsOnlyShortcut?.allowedPaths || [];
  if (!changedFiles.length) return false;

  function match(file, pattern) {
    const f = file.replace(/\\/g, '/');
    if (pattern.endsWith('/**')) {
      const prefix = pattern.slice(0, -3);
      return f === prefix.slice(0, -1) || f.startsWith(prefix);
    }
    return f === pattern;
  }

  return changedFiles.every((f) => allowed.some((p) => match(f, p)));
}

/**
 * Validate certification-status is machine-generated.
 * @param {object} cert
 */
export function assertCertificationGenerated(cert) {
  if (cert.generated !== true) {
    const err = new Error(
      'CERTIFICATION_STATUS_NOT_GENERATED: schemas/certification-status.json must have generated=true'
    );
    err.code = 'CERTIFICATION_STATUS_NOT_GENERATED';
    throw err;
  }
}

/**
 * Compute public status rows for certification merge (sanitized).
 * @param {object} input
 */
export function buildCertificationStatusDocument(input) {
  const support = input.support || loadSupportMatrix(input.root);
  const now = input.certifiedAt || new Date().toISOString();
  /** @type {Record<string, object>} */
  const rows = {};

  for (const row of support.rows || []) {
    const ev = (input.rowEvidence || {})[row.id] || {};
    const supportRowFingerprint = fingerprint({
      id: row.id,
      capability: row.capability,
      version: row.version,
      veracodeCertification: row.veracodeCertification || row.veracode || null,
      lab: row.lab
    });
    const requiredIds = getRequiredVeracodeCases(row).map((c) => c.id);
    const veracodeCases = ev.veracodeCases || {};
    const allCasesPass =
      requiredIds.length > 0 && requiredIds.every((id) => veracodeCases[id] === 'pass' || veracodeCases[id] === 'PASS');
    rows[row.id] = {
      technology: row.technology,
      version: row.version,
      discovery: ev.discovery || 'unknown',
      builder: ev.builder || 'unknown',
      doctor: ev.doctor || 'unknown',
      veracodePipelineScan: allCasesPass ? 'pass' : ev.veracodePipelineScan || 'not_certified',
      veracodeCases,
      requiredVeracodeCaseIds: requiredIds,
      validatedLocal: !!ev.validatedLocal,
      validatedLab: !!ev.validatedLab,
      validatedRealVeracode: allCasesPass || !!ev.validatedRealVeracode,
      supportRowFingerprint,
      status: ev.status || row.declaredLifecycle
    };
  }

  return {
    generated: true,
    schemaVersion: 1,
    description:
      'MACHINE-GENERATED public certification evidence. Do not edit by hand. Regenerated after Release Certification Gate PASS.',
    release: input.release || null,
    sourceSha: input.sourceSha || null,
    certifiedAt: now,
    capabilitiesFingerprint: input.capabilitiesFingerprint || null,
    supportMatrixFingerprint: fingerprint(support),
    matrixFingerprint: input.matrixFingerprint || null,
    labResult: input.labResult || null,
    veracodeResult: input.veracodeResult || null,
    rows,
    notes: {
      readmeRepresents: 'Última certificação publicada.',
      veracodeMeaning: 'validatedRealVeracode=true somente após Pipeline Scan real com Expected CWE Contract PASS.'
    }
  };
}
