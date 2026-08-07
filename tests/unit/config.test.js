'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { validateBuildConfig, migrateBuildConfig } = require('../../internal/utils/schemas/validate');
const { scrubSecretsFromObject } = require('../../internal/utils/sanitize/sanitize');

describe('build config schema', () => {
  it('valida config minimo e remove secrets', () => {
    const raw = {
      schemaVersion: 1,
      repository: 'org/app',
      discovery: { language: 'java', confidence: 'HIGH' },
      builder: { strategy: 'BUILD_REQUIRED' },
      fingerprint: { algorithm: 'sha256', value: 'abc' },
      dependencies: {
        requiredEnvironmentVariables: ['NUGET_TOKEN'],
        leaked: 'ghp_abcdefghijklmnopqrstuvwxyz0123456789'
      }
    };
    const cleaned = validateBuildConfig(scrubSecretsFromObject(raw));
    assert.equal(cleaned.schemaVersion, 1);
    assert.deepEqual(cleaned.dependencies.requiredEnvironmentVariables, ['NUGET_TOKEN']);
    assert.ok(!cleaned.dependencies.leaked);
  });

  it('marca schema futuro como stale', () => {
    assert.throws(
      () =>
        migrateBuildConfig({
          schemaVersion: 99,
          repository: 'org/app',
          discovery: {},
          builder: {},
          fingerprint: { value: 'x' }
        }),
      /stale|nao suportado|migravel/i
    );
  });
});
