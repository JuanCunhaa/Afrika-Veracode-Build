'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { toBuildPlan, mergePlanFromConfig } = require('../../../internal/discovery/build-plan');
const { detect: detectMaven } = require('../../../internal/discovery/detectors/maven');
const { detect: detectJs } = require('../../../internal/discovery/detectors/javascript');
const { detect: detectDotnet } = require('../../../internal/discovery/detectors/dotnet');
const { unitFixtures } = require('../helpers/zip');

describe('build-plan', () => {
  it('Java Maven compiled: HYBRID -> BUILD_REQUIRED', () => {
    const discovery = detectMaven(path.join(unitFixtures, 'maven-projects', 'java17-wrapper'));
    const plan = toBuildPlan(discovery, { javaPackageMode: 'compiled' });
    assert.equal(plan.language, 'java');
    assert.equal(plan.buildSystem, 'maven');
    assert.equal(plan.runtimeVersion, '17');
    assert.equal(plan.strategy, 'BUILD_REQUIRED');
    assert.equal(plan.doctorProfile, 'java-compiled');
  });

  it('Java source mode: SOURCE_PACKAGE', () => {
    const discovery = detectMaven(path.join(unitFixtures, 'maven-projects', 'java17-no-wrapper'));
    const plan = toBuildPlan(discovery, { javaPackageMode: 'source' });
    assert.equal(plan.strategy, 'SOURCE_PACKAGE');
    assert.equal(plan.doctorProfile, 'java-source');
    assert.deepEqual(plan.artifact.patterns, ['**/*.java']);
  });

  it('JavaScript: SOURCE_PACKAGE', () => {
    const discovery = detectJs(path.join(unitFixtures, 'package-json', 'javascript-express'));
    const plan = toBuildPlan(discovery);
    assert.equal(plan.strategy, 'SOURCE_PACKAGE');
    assert.equal(plan.language, 'javascript');
  });

  it('.NET: BUILD_REQUIRED', () => {
    const discovery = detectDotnet(path.join(unitFixtures, 'dotnet-projects', 'net8-console'));
    const plan = toBuildPlan(discovery);
    assert.equal(plan.strategy, 'BUILD_REQUIRED');
    assert.equal(plan.language, 'dotnet');
  });

  it('override packagingStrategy respeitado', () => {
    const discovery = detectJs(path.join(unitFixtures, 'package-json', 'javascript-plain'));
    const plan = toBuildPlan(discovery, { packagingStrategy: 'SOURCE_PACKAGE' });
    assert.equal(plan.strategy, 'SOURCE_PACKAGE');
  });

  it('mergePlanFromConfig prioriza overrides explicitos', () => {
    const plan = mergePlanFromConfig(
      {
        discovery: {
          language: 'java',
          buildSystem: 'maven',
          runtimeVersion: '11',
          confidence: 'HIGH',
          packagingStrategy: 'HYBRID'
        },
        builder: { strategy: 'HYBRID' },
        dependencies: { requiredEnvironmentVariables: [] }
      },
      { runtimeVersion: '21', javaPackageMode: 'compiled' }
    );
    assert.equal(plan.runtimeVersion, '21');
    assert.equal(plan.strategy, 'BUILD_REQUIRED');
  });

  it('preserva HYBRID no discovery; plan efetivo muda no toBuildPlan', () => {
    const discovery = detectMaven(path.join(unitFixtures, 'maven-projects', 'war'));
    assert.equal(discovery.packagingStrategy, 'HYBRID');
    const plan = toBuildPlan(discovery);
    assert.equal(plan.strategy, 'BUILD_REQUIRED');
  });
});
