'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  sanitizeLog,
  scrubSecretsFromObject,
  normalizeRequiredEnvVars,
  looksLikeSecretValue
} = require('../../internal/utils/sanitize/sanitize');

describe('sanitize', () => {
  it('mascara tokens em logs', () => {
    const out = sanitizeLog('token=ghp_abcdefghijklmnopqrstuvwxyz0123456789');
    assert.match(out, /\[REDACTED\]/);
    assert.doesNotMatch(out, /ghp_/);
  });

  it('remove secret values de objetos de config', () => {
    const cleaned = scrubSecretsFromObject({
      requiredEnvironmentVariables: ['NUGET_TOKEN'],
      NUGET_TOKEN: 'ghp_abcdefghijklmnopqrstuvwxyz0123456789',
      ok: 'value'
    });
    assert.equal(cleaned.ok, 'value');
    assert.ok(!cleaned.NUGET_TOKEN);
  });

  it('normaliza apenas nomes de env vars', () => {
    assert.deepEqual(normalizeRequiredEnvVars(['NUGET_TOKEN', 'NUGET_TOKEN']), ['NUGET_TOKEN']);
    assert.throws(() => normalizeRequiredEnvVars(['not a token value!!!']));
  });

  it('detecta valores secret-like', () => {
    assert.equal(looksLikeSecretValue('ghp_abcdefghijklmnopqrstuvwxyz012345'), true);
    assert.equal(looksLikeSecretValue('NUGET_TOKEN'), false);
  });
});
