'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { detect } = require('../../../../internal/discovery/detectors/maven');
const { unitFixtures } = require('../../helpers/zip');

const projects = path.join(unitFixtures, 'maven-projects');

describe('discovery / java-maven', () => {
  it('detecta Java 8 via compiler source/target', () => {
    const d = detect(path.join(projects, 'java8'));
    assert.equal(d.language, 'java');
    assert.equal(d.buildSystem, 'maven');
    assert.equal(d.runtimeVersion, '1.8');
    assert.equal(d.confidence, 'HIGH');
    assert.equal(d.packaging, 'jar');
    assert.equal(d.projectType, 'library-or-app');
  });

  it('detecta Java 11 via maven.compiler.release', () => {
    const d = detect(path.join(projects, 'java11'));
    assert.equal(d.runtimeVersion, '11');
    assert.equal(d.confidence, 'HIGH');
  });

  it('detecta Java 17 via maven.compiler.release', () => {
    const d = detect(path.join(projects, 'java17-no-wrapper'));
    assert.equal(d.runtimeVersion, '17');
    assert.equal(d.packagingStrategy, 'HYBRID');
    assert.equal(d.doctorProfile, 'java-compiled');
  });

  it('detecta Java 21 via java.version', () => {
    const d = detect(path.join(projects, 'java21'));
    assert.equal(d.runtimeVersion, '21');
  });

  it('detecta Java 25 via release (sem allowlist)', () => {
    const d = detect(path.join(projects, 'java25'));
    assert.equal(d.runtimeVersion, '25');
  });

  it('detecta Java 26 via jdk.version', () => {
    const d = detect(path.join(projects, 'java26'));
    assert.equal(d.runtimeVersion, '26');
  });

  it('detecta Spring Boot 17 e 21', () => {
    const d17 = detect(path.join(projects, 'springboot17'));
    assert.equal(d17.framework, 'spring-boot');
    assert.equal(d17.runtimeVersion, '17');
    const d21 = detect(path.join(projects, 'springboot21'));
    assert.equal(d21.framework, 'spring-boot');
    assert.equal(d21.runtimeVersion, '21');
  });

  it('detecta packaging war e ear', () => {
    const war = detect(path.join(projects, 'war'));
    assert.equal(war.packaging, 'war');
    assert.equal(war.projectType, 'web');
    assert.deepEqual(war.artifactCandidates, ['target/*.war']);
    const ear = detect(path.join(projects, 'ear'));
    assert.equal(ear.packaging, 'ear');
    assert.equal(ear.projectType, 'web');
    assert.deepEqual(ear.artifactCandidates, ['target/*.ear']);
  });

  it('detecta multi-module (pom packaging)', () => {
    const d = detect(path.join(projects, 'multimodule'));
    assert.equal(d.language, 'java');
    assert.equal(d.buildSystem, 'maven');
    assert.equal(d.packaging, 'pom');
    assert.equal(d.runtimeVersion, '17');
  });

  it('detecta Maven Wrapper quando mvnw existe', () => {
    const d = detect(path.join(projects, 'java17-wrapper'));
    assert.match(String(d.wrapper), /mvnw/);
  });

  it('usa mvn quando wrapper ausente', () => {
    const d = detect(path.join(projects, 'java17-no-wrapper'));
    assert.equal(d.wrapper, 'mvn');
  });

  it('confidence MEDIUM e runtime auto sem versao', () => {
    const d = detect(path.join(projects, 'no-version'));
    assert.equal(d.runtimeVersion, 'auto');
    assert.equal(d.confidence, 'MEDIUM');
  });

  it('retorna null sem pom.xml', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'maven-empty-'));
    assert.equal(detect(dir), null);
  });

  it('emite warning para maven-shade-plugin', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'maven-shade-'));
    fs.writeFileSync(
      path.join(dir, 'pom.xml'),
      `<?xml version="1.0"?><project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>c</groupId><artifactId>a</artifactId><version>1</version>
  <properties><maven.compiler.release>17</maven.compiler.release></properties>
  <build><plugins><plugin><artifactId>maven-shade-plugin</artifactId></plugin></plugins></build>
</project>`
    );
    const d = detect(dir);
    assert.ok(d.warnings.some((w) => /Shade/i.test(w)));
  });
});
