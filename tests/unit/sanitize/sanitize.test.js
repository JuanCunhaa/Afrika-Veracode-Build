'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  sanitizeLog,
  sanitizeText,
  sanitizeCommand,
  scrubSecretsFromObject,
  normalizeRequiredEnvVars,
  looksLikeSecretValue,
  looksLikeSecretEnvName,
  registerSecret,
  _resetRegisteredSecretsForTests,
  REDACTED
} = require('../../../internal/utils/sanitize/sanitize');

describe('sanitize', () => {
  beforeEach(() => _resetRegisteredSecretsForTests());
  afterEach(() => _resetRegisteredSecretsForTests());

  it('remove chave SUPER_SECRET_TEST_839201 de objetos persistidos', () => {
    const cleaned = scrubSecretsFromObject({
      SUPER_SECRET_TEST_839201: 'value-must-not-persist',
      ok: 'safe'
    });
    assert.equal(cleaned.ok, 'safe');
    assert.ok(!cleaned.SUPER_SECRET_TEST_839201);
  });

  it('mascara Bearer / ghp_ / private key em logs', () => {
    assert.ok(sanitizeLog('Authorization: Bearer abcdefghijklmnop.qrstuv').includes(REDACTED));
    assert.doesNotMatch(sanitizeLog('token=ghp_abcdefghijklmnopqrstuvwxyz0123456789'), /ghp_/);
    const pem = sanitizeLog('-----BEGIN RSA PRIVATE KEY-----\nABC\n-----END RSA PRIVATE KEY-----');
    assert.ok(pem.includes(REDACTED));
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
    assert.equal(sanitizeText(innocent), innocent);
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

  it('sanitizeCommand mascara --password e registerSecret', () => {
    registerSecret('SUPER_SECRET_TEST_839201');
    const line = sanitizeCommand('dotnet', ['nuget', 'add', 'source', 'u', '--password', 'SUPER_SECRET_TEST_839201']);
    assert.doesNotMatch(line, /SUPER_SECRET_TEST_839201/);
    assert.match(line, /--password \*\*\*/);
  });
});
