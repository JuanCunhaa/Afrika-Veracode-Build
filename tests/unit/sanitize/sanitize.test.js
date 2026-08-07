'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  sanitizeLog,
  scrubSecretsFromObject,
  normalizeRequiredEnvVars,
  looksLikeSecretValue,
  looksLikeSecretEnvName
} = require('../../../internal/utils/sanitize/sanitize');

describe('sanitize', () => {
  it('remove chave SUPER_SECRET_TEST_839201 de objetos persistidos', () => {
    const cleaned = scrubSecretsFromObject({
      SUPER_SECRET_TEST_839201: 'value-must-not-persist',
      ok: 'safe'
    });
    assert.equal(cleaned.ok, 'safe');
    assert.ok(!cleaned.SUPER_SECRET_TEST_839201);
  });

  it('mascara Bearer / ghp_ / private key em logs', () => {
    assert.match(sanitizeLog('Authorization: Bearer abcdefghijklmnop.qrstuv'), /\[REDACTED\]/);
    assert.doesNotMatch(sanitizeLog('token=ghp_abcdefghijklmnopqrstuvwxyz0123456789'), /ghp_/);
    const pem = sanitizeLog('-----BEGIN RSA PRIVATE KEY-----\nABC\n-----END RSA PRIVATE KEY-----');
    assert.match(pem, /\[REDACTED\]/);
  });

  it('reconhece nomes secret-like (token, password, private key, auth)', () => {
    assert.equal(looksLikeSecretEnvName('API_TOKEN'), true);
    assert.equal(looksLikeSecretEnvName('DB_PASSWORD'), true);
    assert.equal(looksLikeSecretEnvName('PRIVATE_KEY'), true);
    assert.equal(looksLikeSecretEnvName('AUTHORIZATION_HEADER'), true);
    assert.equal(looksLikeSecretEnvName('NODE_ENV'), false);
  });

  it('nao mascara conteudo inocente indevidamente', () => {
    const innocent = 'Use Authorization header documentation; Basic setup guide; password policy docs';
    assert.equal(sanitizeLog(innocent), innocent);
    assert.equal(looksLikeSecretValue('NUGET_TOKEN'), false);
    assert.equal(looksLikeSecretValue('short'), false);
  });

  it('detecta valores secret-like conhecidos', () => {
    assert.equal(looksLikeSecretValue('ghp_abcdefghijklmnopqrstuvwxyz012345'), true);
    assert.equal(looksLikeSecretValue('Bearer eyJhbGciOiJIUzI1NiJ9.abc'), true);
  });

  it('normaliza apenas nomes de env vars', () => {
    assert.deepEqual(normalizeRequiredEnvVars(['NUGET_TOKEN', 'NUGET_TOKEN']), ['NUGET_TOKEN']);
    assert.throws(() => normalizeRequiredEnvVars(['not a token value!!!']));
  });
});
