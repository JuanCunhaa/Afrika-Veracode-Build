'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  validateBuildConfig,
  migrateBuildConfig,
  SUPPORTED_SCHEMA_VERSION
} = require('../../../internal/utils/schemas/validate');
const { scrubSecretsFromObject } = require('../../../internal/utils/sanitize/sanitize');
const { tmpDir } = require('../helpers/assert');

describe('negative / config', () => {
  it('JSON invalido nao e parseavel como BuildConfig', () => {
    const dir = tmpDir('cfg-badjson-');
    const file = path.join(dir, 'build-config.json');
    fs.writeFileSync(file, '{ not json');
    assert.throws(() => JSON.parse(fs.readFileSync(file, 'utf8')));
  });

  it('schemaVersion desconhecido → CONFIG_STALE', () => {
    let caught;
    try {
      migrateBuildConfig({
        schemaVersion: SUPPORTED_SCHEMA_VERSION + 50,
        repository: 'org/app',
        discovery: {},
        builder: {},
        fingerprint: { value: 'x' }
      });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught);
    assert.equal(caught.code, 'CONFIG_STALE');
  });

  it('fingerprint ausente → SCHEMA_INVALID', () => {
    let caught;
    try {
      validateBuildConfig({
        schemaVersion: 1,
        repository: 'org/app',
        discovery: { language: 'java' },
        builder: { strategy: 'BUILD_REQUIRED' }
      });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught);
    assert.equal(caught.code, 'SCHEMA_INVALID');
  });

  it('campo obrigatorio ausente (discovery) → SCHEMA_INVALID', () => {
    let caught;
    try {
      validateBuildConfig({
        schemaVersion: 1,
        repository: 'org/app',
        builder: {},
        fingerprint: { value: 'abc' }
      });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught);
    assert.equal(caught.code, 'SCHEMA_INVALID');
  });

  it('secret SUPER_SECRET_TEST_839201 persistido e removido na sanitizacao', () => {
    const raw = {
      schemaVersion: 1,
      repository: 'org/app',
      discovery: { language: 'dotnet', confidence: 'HIGH' },
      builder: { strategy: 'BUILD_REQUIRED' },
      fingerprint: { algorithm: 'sha256', value: 'deadbeef' },
      NUGET_TOKEN: 'SUPER_SECRET_TEST_839201',
      dependencies: {
        requiredEnvironmentVariables: ['NUGET_TOKEN'],
        NUGET_TOKEN: 'SUPER_SECRET_TEST_839201'
      }
    };
    const cleaned = validateBuildConfig(scrubSecretsFromObject(raw));
    const serialized = JSON.stringify(cleaned);
    assert.doesNotMatch(serialized, /SUPER_SECRET_TEST_839201/);
    assert.ok(!cleaned.NUGET_TOKEN);
    assert.ok(!cleaned.dependencies?.NUGET_TOKEN);
    assert.deepEqual(cleaned.dependencies.requiredEnvironmentVariables, ['NUGET_TOKEN']);
  });
});
