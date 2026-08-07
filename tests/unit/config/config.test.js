'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  validateBuildConfig,
  migrateBuildConfig,
  validateBuildPlan,
  validateDiscoveryResult,
  SUPPORTED_SCHEMA_VERSION
} = require('../../../internal/utils/schemas/validate');
const { scrubSecretsFromObject } = require('../../../internal/utils/sanitize/sanitize');
const { unitFixtures } = require('../helpers/zip');

describe('config / schema', () => {
  it('valida config valido e schemaVersion', () => {
    const raw = JSON.parse(fs.readFileSync(path.join(unitFixtures, 'configs', 'valid-config.json'), 'utf8'));
    const cleaned = validateBuildConfig(raw);
    assert.equal(cleaned.schemaVersion, SUPPORTED_SCHEMA_VERSION);
    assert.equal(cleaned.repository, 'org/app');
    assert.equal(cleaned.fingerprint.value, 'abc123');
  });

  it('rejeita config incompleto', () => {
    const raw = JSON.parse(fs.readFileSync(path.join(unitFixtures, 'configs', 'incomplete-config.json'), 'utf8'));
    assert.throws(() => validateBuildConfig(raw), /discovery|builder|fingerprint/i);
  });

  it('schema desconhecido/futuro e stale', () => {
    const raw = JSON.parse(fs.readFileSync(path.join(unitFixtures, 'configs', 'future-schema.json'), 'utf8'));
    assert.throws(() => migrateBuildConfig(raw), /stale|nao migravel|nao suportado/i);
  });

  it('nao aceita secrets como dado persistente', () => {
    const raw = {
      schemaVersion: 1,
      repository: 'org/app',
      discovery: { language: 'java', confidence: 'HIGH' },
      builder: { strategy: 'BUILD_REQUIRED' },
      fingerprint: { algorithm: 'sha256', value: 'abc' },
      dependencies: {
        requiredEnvironmentVariables: ['NUGET_TOKEN'],
        SUPER_SECRET_TEST_839201: 'should-not-persist',
        leaked: 'ghp_abcdefghijklmnopqrstuvwxyz0123456789'
      }
    };
    const cleaned = validateBuildConfig(scrubSecretsFromObject(raw));
    assert.deepEqual(cleaned.dependencies.requiredEnvironmentVariables, ['NUGET_TOKEN']);
    assert.ok(!cleaned.dependencies.SUPER_SECRET_TEST_839201);
    assert.ok(!cleaned.dependencies.leaked);
  });

  it('validateBuildPlan e DiscoveryResult basicos', () => {
    const plan = validateBuildPlan({
      schemaVersion: 1,
      language: 'java',
      strategy: 'BUILD_REQUIRED',
      projectPath: '.'
    });
    assert.equal(plan.strategy, 'BUILD_REQUIRED');
    const disc = validateDiscoveryResult({
      schemaVersion: 1,
      language: 'javascript',
      confidence: 'HIGH'
    });
    assert.equal(disc.language, 'javascript');
  });
});
