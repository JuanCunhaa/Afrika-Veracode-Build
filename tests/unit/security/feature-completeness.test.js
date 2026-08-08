'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { runCheck, validateCapability, CODE } = require('../../security/check-feature-completeness');

describe('feature-completeness', () => {
  it('current capabilities.json passes the completeness contract', () => {
    const { ok, failures } = runCheck();
    assert.equal(ok, true, JSON.stringify(failures, null, 2));
  });

  it('beta capability without discovery fails', () => {
    const missing = validateCapability(
      'fake-lang',
      {
        status: 'beta',
        buildRequired: false,
        packagingRequired: true,
        discoveryDetector: null,
        builderPath: 'internal/builder/javascript',
        doctorModule: 'internal/doctor/javascript/doctor.js',
        doctorProfiles: ['javascript-source'],
        unitGlobs: ['tests/unit/discovery/javascript'],
        negativeRequired: true,
        contractFamily: 'javascript',
        integrationFixtureRoot: 'tests/fixtures/integration/javascript',
        goldenArtifactsRoot: 'tests/artifacts/javascript',
        testMatrixKey: 'javascript',
        veracodeE2E: false
      },
      { javascript: [{ case: 'x', profiles: ['full'] }] },
      new Set(['javascript-source']),
      'JavaScript',
      'JavaScript'
    );
    assert.ok(missing.some((m) => /discovery/i.test(m)));
  });

  it('stable without E2E evidence fails', () => {
    const missing = validateCapability(
      'javascript',
      {
        status: 'stable',
        buildRequired: false,
        packagingRequired: true,
        discoveryDetector: 'internal/discovery/detectors/javascript.js',
        builderPath: 'internal/builder/javascript',
        doctorModule: 'internal/doctor/javascript/doctor.js',
        doctorProfiles: ['javascript-source'],
        unitGlobs: ['tests/unit/discovery/javascript'],
        negativeRequired: true,
        contractFamily: 'javascript',
        integrationFixtureRoot: 'tests/fixtures/integration/javascript',
        goldenArtifactsRoot: 'tests/artifacts/javascript',
        testMatrixKey: 'javascript',
        readmeRow: 'JavaScript',
        veracodePackagingSection: 'JavaScript',
        veracodeE2E: false
      },
      { javascript: [{ case: 'x', profiles: ['full'] }] },
      new Set(['javascript-source']),
      'JavaScript',
      'JavaScript'
    );
    assert.ok(missing.some((m) => /veracodeE2E/i.test(m) || /E2E evidence/i.test(m)));
  });

  it('exports FEATURE_COMPLETENESS_FAILED code', () => {
    assert.equal(CODE, 'FEATURE_COMPLETENESS_FAILED');
  });

  it('SOURCE_PACKAGE with buildRequired false does not require a fake build gate', () => {
    const missing = validateCapability(
      'javascript',
      {
        status: 'beta',
        buildRequired: false,
        packagingRequired: true,
        discoveryDetector: 'internal/discovery/detectors/javascript.js',
        builderPath: 'internal/builder/javascript',
        doctorModule: 'internal/doctor/javascript/doctor.js',
        doctorProfiles: ['javascript-source'],
        unitGlobs: ['tests/unit/discovery/javascript'],
        negativeRequired: true,
        contractFamily: 'javascript',
        integrationFixtureRoot: 'tests/fixtures/integration/javascript',
        goldenArtifactsRoot: 'tests/artifacts/javascript',
        testMatrixKey: 'javascript',
        readmeRow: 'JavaScript',
        veracodePackagingSection: 'JavaScript',
        veracodeE2E: false
      },
      { javascript: [{ case: 'x', profiles: ['full'] }] },
      new Set(['javascript-source']),
      'JavaScript',
      'JavaScript'
    );
    assert.deepEqual(missing, []);
  });
});
