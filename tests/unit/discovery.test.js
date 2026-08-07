'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { discover } = require('../../internal/discovery/discovery');
const { toBuildPlan } = require('../../internal/discovery/build-plan');

const fixtures = path.join(__dirname, '..', 'fixtures');

describe('discovery', () => {
  it('detecta Java Maven', () => {
    const d = discover(path.join(fixtures, 'java-maven'));
    assert.equal(d.language, 'java');
    assert.equal(d.buildSystem, 'maven');
    assert.equal(d.runtimeVersion, '17');
    const plan = toBuildPlan(d, { javaPackageMode: 'compiled' });
    assert.equal(plan.strategy, 'BUILD_REQUIRED');
    assert.equal(plan.doctorProfile, 'java-compiled');
  });

  it('detecta Java Gradle', () => {
    const d = discover(path.join(fixtures, 'java-gradle'));
    assert.equal(d.language, 'java');
    assert.equal(d.buildSystem, 'gradle');
  });

  it('detecta JavaScript express e SOURCE_PACKAGE', () => {
    const d = discover(path.join(fixtures, 'javascript'));
    assert.equal(d.language, 'javascript');
    assert.equal(d.framework, 'express');
    assert.equal(d.packageManager, 'npm');
    const plan = toBuildPlan(d);
    assert.equal(plan.strategy, 'SOURCE_PACKAGE');
  });

  it('detecta TypeScript via tsconfig', () => {
    const d = discover(path.join(fixtures, 'typescript'));
    assert.equal(d.language, 'typescript');
    assert.equal(d.framework, 'react');
  });

  it('detecta .NET moderno', () => {
    const d = discover(path.join(fixtures, 'dotnet-modern'));
    assert.equal(d.language, 'dotnet');
    assert.ok(String(d.runtimeVersion).includes('net8') || d.targetFrameworks?.includes('net8.0'));
  });
});
