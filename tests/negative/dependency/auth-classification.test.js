'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { classifyDependencyError, ERROR_CODES } = require('../../../internal/utils/errors/errors');

describe('negative / dependency', () => {
  const authSamples = [
    'error NU1301: Unable to load the service index for source',
    'Response status code does not indicate success: 401 (Unauthorized)',
    '403 Forbidden from nuget.org',
    'Authentication failed for feed',
    'Unable to load service index for source https://pkgs.dev.azure.com/_packaging/feed/nuget/v3/index.json',
    'npm ERR! code E401\nnpm ERR! 401 Unauthorized'
  ];

  for (const sample of authSamples) {
    it(`classifica como DEPENDENCY_AUTH_REQUIRED: ${sample.slice(0, 48)}…`, () => {
      const code = classifyDependencyError(sample);
      assert.equal(
        code,
        ERROR_CODES.DEPENDENCY_AUTH_REQUIRED,
        `Expected:\n${ERROR_CODES.DEPENDENCY_AUTH_REQUIRED}\n\nReceived:\n${code}\n\nInput:\n${sample}`
      );
      assert.notEqual(code, ERROR_CODES.BUILD_FAILED);
    });
  }

  const registrySamples = [
    'getaddrinfo ENOTFOUND registry.npmjs.org',
    'connect ECONNREFUSED 127.0.0.1:4873',
    'Error: ETIMEDOUT',
    'Could not resolve host: nuget.example.invalid',
    'registry.npmjs.org unavailable'
  ];

  for (const sample of registrySamples) {
    it(`classifica como DEPENDENCY_REGISTRY_UNAVAILABLE: ${sample.slice(0, 40)}…`, () => {
      const code = classifyDependencyError(sample);
      assert.equal(
        code,
        ERROR_CODES.DEPENDENCY_REGISTRY_UNAVAILABLE,
        `Expected:\n${ERROR_CODES.DEPENDENCY_REGISTRY_UNAVAILABLE}\n\nReceived:\n${code}`
      );
      assert.notEqual(code, ERROR_CODES.BUILD_FAILED);
    });
  }

  it('erro generico de compile nao vira AUTH', () => {
    assert.equal(classifyDependencyError('error: compilation failed CS0001'), null);
  });
});
