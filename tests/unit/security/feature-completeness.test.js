'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { runCheck, validateCapability, CODE } = require('../../security/check-feature-completeness');

function labOk(overrides = {}) {
  return {
    required: true,
    integrationSuite: 'javascript',
    contractSuite: 'javascript',
    goldenSuite: 'javascript',
    matrixKey: 'javascript',
    veracodeE2E: false,
    ...overrides
  };
}

describe('feature-completeness (Action)', () => {
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
        labValidation: labOk(),
        veracodeE2E: false
      },
      new Set(['javascript-source']),
      'JavaScript',
      'JavaScript'
    );
    assert.ok(missing.some((m) => /discovery/i.test(m)));
  });

  it('stable without E2E flag fails (evidence lives in Lab)', () => {
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
        labValidation: labOk({ veracodeE2E: false }),
        readmeRow: 'JavaScript',
        veracodePackagingSection: 'JavaScript',
        veracodeE2E: false
      },
      new Set(['javascript-source']),
      'JavaScript',
      'JavaScript'
    );
    assert.ok(missing.some((m) => /veracodeE2E/i.test(m)));
  });

  it('does not require local integrationFixtureRoot / golden / contract cases / matrix file', () => {
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
        labValidation: labOk(),
        readmeRow: 'JavaScript',
        veracodePackagingSection: 'JavaScript',
        veracodeE2E: false
      },
      new Set(['javascript-source']),
      'JavaScript',
      'JavaScript'
    );
    assert.deepEqual(missing, []);
    assert.ok(!missing.some((m) => /integrationFixture|goldenArtifacts|cases\.json|test-matrix/i.test(m)));
  });

  it('requires labValidation keys when present for beta', () => {
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
        labValidation: { required: true },
        readmeRow: 'JavaScript',
        veracodePackagingSection: 'JavaScript',
        veracodeE2E: false
      },
      new Set(['javascript-source']),
      'JavaScript',
      'JavaScript'
    );
    assert.ok(missing.some((m) => /labValidation\./.test(m)));
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
        labValidation: labOk(),
        readmeRow: 'JavaScript',
        veracodePackagingSection: 'JavaScript',
        veracodeE2E: false
      },
      new Set(['javascript-source']),
      'JavaScript',
      'JavaScript'
    );
    assert.deepEqual(missing, []);
  });
});
