'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { detect } = require('../../../../internal/discovery/detectors/gradle');
const { unitFixtures } = require('../../helpers/zip');

const gradle = path.join(unitFixtures, 'gradle');

describe('discovery / java-gradle', () => {
  it('detecta sourceCompatibility string', () => {
    const d = detect(path.join(gradle, 'java17-sourcecompat'));
    assert.equal(d.language, 'java');
    assert.equal(d.buildSystem, 'gradle');
    assert.equal(d.runtimeVersion, '17');
    assert.equal(d.confidence, 'HIGH');
    assert.equal(d.packagingStrategy, 'HYBRID');
  });

  it('detecta JavaVersion.VERSION_21', () => {
    const d = detect(path.join(gradle, 'java21-versionenum'));
    assert.equal(d.runtimeVersion, '21');
    assert.equal(d.packaging, 'jar');
    assert.equal(d.projectType, 'library-or-app');
  });

  it('detecta JavaVersion.VERSION_1_8 as runtime 8 (not 1)', () => {
    const d = detect(path.join(gradle, 'java8-versionenum'));
    assert.equal(d.runtimeVersion, '8');
    assert.equal(d.buildSystem, 'gradle');
  });

  it('detecta Java toolchain em Kotlin DSL', () => {
    const d = detect(path.join(gradle, 'java17-toolchain'));
    assert.equal(d.runtimeVersion, '17');
    assert.equal(d.buildSystem, 'gradle');
  });

  it('detecta toolchain via languageVersion.set', () => {
    const d = detect(path.join(gradle, 'kts-settings'));
    assert.equal(d.runtimeVersion, '21');
  });

  it('detecta Spring Boot', () => {
    const d = detect(path.join(gradle, 'springboot-java17'));
    assert.equal(d.framework, 'spring-boot');
    assert.equal(d.runtimeVersion, '17');
  });

  it('detecta WAR plugin', () => {
    const d = detect(path.join(gradle, 'war'));
    assert.equal(d.packaging, 'war');
    assert.equal(d.projectType, 'web');
  });

  it('detecta java-library como jar', () => {
    const d = detect(path.join(gradle, 'library'));
    assert.equal(d.packaging, 'jar');
    assert.equal(d.runtimeVersion, '11');
  });

  it('detecta multi-module settings.gradle e artifact patterns por modulo', () => {
    const d = detect(path.join(gradle, 'multimodule'));
    assert.equal(d.language, 'java');
    assert.equal(d.buildSystem, 'gradle');
    assert.equal(d.runtimeVersion, '17');
    assert.ok(d.artifactCandidates.includes('api/build/libs/*.jar'));
    assert.ok(d.artifactCandidates.includes('core/build/libs/*.jar'));
    assert.ok(d.artifactCandidates.includes('*/build/libs/*.jar'));
  });

  it('detecta Gradle Wrapper', () => {
    const d = detect(path.join(gradle, 'wrapper-project'));
    assert.match(String(d.wrapper), /gradlew/);
  });

  it('wrapper ausente usa gradle', () => {
    const d = detect(path.join(gradle, 'java17-sourcecompat'));
    assert.equal(d.wrapper, 'gradle');
  });
});
