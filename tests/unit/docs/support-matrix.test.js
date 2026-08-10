'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const LIB = path.resolve(__dirname, '../../../scripts/docs/support-matrix-lib.mjs');

describe('support-matrix generator', () => {
  /** @type {any} */
  let lib;

  it('loads module', async () => {
    lib = await import(pathToFileURL(LIB).href);
    assert.ok(lib.loadSupportMatrix);
  });

  it('new capability appears automatically in markdown', async () => {
    lib = lib || (await import(pathToFileURL(LIB).href));
    const support = {
      rows: [
        {
          id: 'python',
          capability: 'python',
          technology: 'Python',
          version: '—',
          declaredLifecycle: 'planned',
          releaseEligible: false,
          veracodeCertificationRequired: false,
          lab: null,
          veracode: null
        }
      ]
    };
    const md = lib.generateSupportMatrixMarkdown({ support, cert: { generated: true, rows: {} } });
    assert.match(md, /\| Python \| — \|/);
    assert.match(md, /Planejado/);
  });

  it('new runtime appears automatically', async () => {
    lib = lib || (await import(pathToFileURL(LIB).href));
    const support = {
      rows: [
        {
          id: 'java-maven-java27',
          capability: 'java-maven',
          technology: 'Java + Maven',
          version: '27',
          declaredLifecycle: 'beta',
          releaseEligible: true,
          veracodeCertificationRequired: true,
          lab: { primaryCase: 'java27-basic' },
          veracode: { family: 'java-maven' }
        }
      ]
    };
    const md = lib.generateSupportMatrixMarkdown({ support, cert: { generated: true, rows: {} } });
    assert.match(md, /\| Java \+ Maven \| 27 \|/);
    assert.match(md, /⏳/);
  });

  it('Stable requires ALL required Veracode cases (JAR+WAR)', async () => {
    lib = lib || (await import(pathToFileURL(LIB).href));
    const support = lib.loadSupportMatrix();
    const row = support.rows.find((r) => r.id === 'java-maven-java17');
    assert.ok(row);
    const required = lib.getRequiredVeracodeCases(row);
    assert.equal(required.length, 2);
    assert.ok(required.some((c) => c.variant === 'jar'));
    assert.ok(required.some((c) => c.variant === 'war'));

    const jarOnly = lib.resolveRowStatus(row, {
      validatedLab: true,
      discovery: 'pass',
      builder: 'pass',
      doctor: 'pass',
      veracodeCases: { 'java-maven-java17': 'pass' }
    });
    assert.equal(jarOnly.veracode, '⏳');
    assert.notEqual(jarOnly.statusKey, 'stable');

    const fp = lib.fingerprint({
      id: row.id,
      capability: row.capability,
      version: row.version,
      veracodeCertification: row.veracodeCertification || row.veracode || null,
      lab: row.lab
    });
    const both = lib.resolveRowStatus(row, {
      validatedLab: true,
      discovery: 'pass',
      builder: 'pass',
      doctor: 'pass',
      veracodeCases: {
        'java-maven-java17': 'pass',
        'java-maven-war-java17': 'pass'
      },
      supportRowFingerprint: fp
    });
    assert.equal(both.veracode, '✅');
    assert.equal(both.statusKey, 'stable');
  });

  it('release Veracode full is all Lab Compatibility Full cases', async () => {
    lib = lib || (await import(pathToFileURL(LIB).href));
    const support = lib.loadSupportMatrix();
    const expected = support.veracodeProfiles.full.expectedCaseCount;
    const n = lib.countReleaseVeracodeFull();
    assert.equal(n, expected);
    assert.equal(lib.countDeclaredLabCompatibilityCases(), expected);
    const packaging = lib.buildPipelineCasesFromSupport(undefined, 'full');
    assert.ok(packaging.length >= 14, `packaging variants expected ≥14, got ${packaging.length}`);
    assert.ok(
      packaging.some((c) => c.id === 'java-maven-war-java17'),
      'WAR must remain a packaging variant'
    );
    assert.ok(
      packaging.some((c) => c.id === 'java-gradle-war-java17'),
      'Gradle WAR must be a packaging variant'
    );
    assert.ok(
      packaging.some((c) => c.id === 'java-maven-java8'),
      'Java 8 must be certified explicitly'
    );
  });

  it('representative stays curated (~7) and is not every version', async () => {
    lib = lib || (await import(pathToFileURL(LIB).href));
    const rep = lib.buildPipelineCasesFromSupport(undefined, 'representative');
    assert.equal(rep.length, 7);
    assert.ok(!rep.some((c) => c.id === 'java-maven-java8'));
  });

  it('Stable requires real Veracode evidence', async () => {
    lib = lib || (await import(pathToFileURL(LIB).href));
    const row = {
      id: 'dotnet-net8',
      capability: 'dotnet-modern',
      technology: '.NET',
      version: '8',
      declaredLifecycle: 'beta',
      lab: { primaryCase: 'net8-webapi' },
      veracodeCertification: {
        required: true,
        cases: [{ id: 'dotnet-net8', variant: 'assembly', required: true, family: 'dotnet' }]
      }
    };
    const without = lib.resolveRowStatus(row, {
      discovery: 'pass',
      builder: 'pass',
      doctor: 'pass',
      validatedLab: true,
      validatedRealVeracode: false
    });
    assert.equal(without.statusKey, 'beta');
    assert.equal(without.veracode, '⏳');

    const fp = lib.fingerprint({
      id: row.id,
      capability: row.capability,
      version: row.version,
      veracodeCertification: row.veracodeCertification,
      lab: row.lab
    });
    const stable = lib.resolveRowStatus(row, {
      discovery: 'pass',
      builder: 'pass',
      doctor: 'pass',
      validatedLab: true,
      veracodeCases: { 'dotnet-net8': 'pass' },
      supportRowFingerprint: fp
    });
    assert.equal(stable.statusKey, 'stable');
    assert.equal(stable.veracode, '✅');
  });

  it('Beta without Veracode', async () => {
    lib = lib || (await import(pathToFileURL(LIB).href));
    const r = lib.resolveRowStatus(
      {
        id: 'x',
        declaredLifecycle: 'beta',
        lab: {},
        veracodeCertification: { required: true, cases: [] }
      },
      { validatedLab: true, discovery: 'pass', builder: 'pass', doctor: 'pass' }
    );
    assert.equal(r.statusKey, 'beta');
    assert.equal(r.veracode, '⏳');
  });

  it('Planned and Experimental rows', async () => {
    lib = lib || (await import(pathToFileURL(LIB).href));
    const planned = lib.resolveRowStatus({ declaredLifecycle: 'planned' }, null);
    assert.equal(planned.statusKey, 'planned');
    const exp = lib.resolveRowStatus({ declaredLifecycle: 'experimental', lab: null }, null);
    assert.equal(exp.statusKey, 'experimental');
  });

  it('missing certification evidence does not invent Veracode PASS', async () => {
    lib = lib || (await import(pathToFileURL(LIB).href));
    const support = lib.loadSupportMatrix();
    const md = lib.generateSupportMatrixMarkdown({
      support,
      cert: { generated: true, rows: {} }
    });
    const stableLines = md.split('\n').filter((l) => l.includes('| Stable |'));
    assert.equal(stableLines.length, 0);
  });

  it('stale evidence clears Veracode PASS', async () => {
    lib = lib || (await import(pathToFileURL(LIB).href));
    const row = {
      id: 'java-maven-java17',
      capability: 'java-maven',
      version: '17',
      declaredLifecycle: 'beta',
      lab: { primaryCase: 'java17-basic' },
      veracodeCertification: {
        required: true,
        cases: [
          { id: 'java-maven-java17', variant: 'jar', required: true },
          { id: 'java-maven-war-java17', variant: 'war', required: true }
        ]
      }
    };
    const r = lib.resolveRowStatus(row, {
      validatedLab: true,
      discovery: 'pass',
      builder: 'pass',
      doctor: 'pass',
      veracodeCases: {
        'java-maven-java17': 'pass',
        'java-maven-war-java17': 'pass'
      },
      supportRowFingerprint: 'stale-fingerprint'
    });
    assert.equal(r.veracode, '⏳');
    assert.equal(r.stale, true);
  });

  it('event policy docs-only shortcut rejects code changes', async () => {
    lib = lib || (await import(pathToFileURL(LIB).href));
    const policy = lib.loadEventPolicy();
    assert.equal(lib.isDocsOnlyChange(['README.md', 'schemas/certification-status.json'], policy), true);
    assert.equal(lib.isDocsOnlyChange(['README.md', 'internal/builder/index.js'], policy), false);
  });

  it('certification status must be generated', async () => {
    lib = lib || (await import(pathToFileURL(LIB).href));
    assert.throws(() => lib.assertCertificationGenerated({ generated: false }), /CERTIFICATION_STATUS_NOT_GENERATED/);
    lib.assertCertificationGenerated({ generated: true });
  });
});
