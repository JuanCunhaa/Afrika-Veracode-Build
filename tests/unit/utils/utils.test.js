'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { ERROR_CODES, classifyDependencyError } = require('../../../internal/utils/errors/errors');
const { isAuto, envBool, envStr } = require('../../../internal/utils/common/io');

describe('utils', () => {
  it('ERROR_CODES expoe codigos criticos', () => {
    assert.ok(ERROR_CODES.UNSUPPORTED_LANGUAGE);
    assert.ok(ERROR_CODES.AMBIGUOUS_PROJECT);
    assert.ok(ERROR_CODES.NOT_IMPLEMENTED);
    assert.ok(ERROR_CODES.BUILDER_DOCTOR_CONTRACT_BROKEN);
    assert.ok(ERROR_CODES.SECRET_LEAK_DETECTED);
  });

  it('classifyDependencyError reconhece auth/network', () => {
    assert.equal(classifyDependencyError('401 Unauthorized token'), ERROR_CODES.DEPENDENCY_AUTH_REQUIRED);
    assert.equal(classifyDependencyError('ENOTFOUND registry.npmjs.org'), ERROR_CODES.DEPENDENCY_REGISTRY_UNAVAILABLE);
  });

  it('isAuto trata auto/vazio', () => {
    assert.equal(isAuto('auto'), true);
    assert.equal(isAuto(''), true);
    assert.equal(isAuto('maven'), false);
  });

  it('envBool e envStr', () => {
    process.env.AVB_TEST_BOOL = 'true';
    assert.equal(envBool('AVB_TEST_BOOL'), true);
    process.env.AVB_TEST_STR = 'hello';
    assert.equal(envStr('AVB_TEST_STR'), 'hello');
    delete process.env.AVB_TEST_BOOL;
    delete process.env.AVB_TEST_STR;
  });
});
