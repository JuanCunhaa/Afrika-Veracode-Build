'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { discover } = require('../../../internal/discovery/discovery');
const { unitFixtures } = require('../helpers/zip');

describe('discovery orchestrator', () => {
  it('escolhe maven em fixture java-maven de integracao', () => {
    const d = discover(path.join(__dirname, '..', '..', 'fixtures', 'java-maven'));
    assert.equal(d.language, 'java');
    assert.equal(d.buildSystem, 'maven');
  });

  it('escolhe javascript em package-json fixture', () => {
    const d = discover(path.join(unitFixtures, 'package-json', 'javascript-express'));
    assert.equal(d.language, 'javascript');
    assert.equal(d.framework, 'express');
  });

  it('respeita override de language=dotnet', () => {
    const d = discover(path.join(unitFixtures, 'dotnet-projects', 'net8-console'), { language: 'dotnet' });
    assert.equal(d.language, 'dotnet');
  });
});
