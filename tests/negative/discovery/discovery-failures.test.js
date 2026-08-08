'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { discover } = require('../../../internal/discovery/discovery');
const { detect: detectMaven } = require('../../../internal/discovery/detectors/maven');
const { ERROR_CODES } = require('../../../internal/utils/errors/errors');
const { assertFailsWith, tmpDir } = require('../helpers/assert');

describe('negative / discovery', () => {
  it('projeto sem manifest → UNSUPPORTED_LANGUAGE', () => {
    const dir = tmpDir('disc-unknown-');
    fs.writeFileSync(path.join(dir, 'README.md'), '# no manifests');
    fs.writeFileSync(path.join(dir, 'notes.txt'), 'python?');
    assertFailsWith(() => discover(dir), ERROR_CODES.UNSUPPORTED_LANGUAGE);
  });

  it('projeto inexistente → PROJECT_NOT_FOUND', () => {
    assertFailsWith(() => discover(path.join(tmpDir(), 'missing-src')), ERROR_CODES.PROJECT_NOT_FOUND);
  });

  it('multiplos .sln sem project_path → AMBIGUOUS_PROJECT', () => {
    const dir = tmpDir('disc-ambig-');
    for (const name of ['backend.sln', 'admin.sln', 'legacy.sln']) {
      fs.writeFileSync(
        path.join(dir, name),
        `Microsoft Visual Studio Solution File\nProject("{}") = "X", "X.csproj"\n`
      );
    }
    assertFailsWith(() => discover(dir), ERROR_CODES.AMBIGUOUS_PROJECT);
  });

  it('Java sem versao identificavel → runtime auto (nao inventa JDK)', () => {
    const dir = tmpDir('disc-java-nover-');
    fs.writeFileSync(
      path.join(dir, 'pom.xml'),
      `<?xml version="1.0"?><project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>c</groupId><artifactId>a</artifactId><version>1</version>
  <properties><project.build.sourceEncoding>UTF-8</project.build.sourceEncoding></properties>
</project>`
    );
    const d = detectMaven(dir);
    assert.equal(d.runtimeVersion, 'auto');
    assert.equal(d.confidence, 'MEDIUM');
    // Discovery nao falha: builders devem resolver toolchain explicitamente / auto setup
    const full = discover(dir);
    assert.equal(full.runtimeVersion, 'auto');
  });

  it('framework ausente nao falha discovery (framework=none)', () => {
    const dir = tmpDir('disc-nofw-');
    fs.writeFileSync(
      path.join(dir, 'pom.xml'),
      `<?xml version="1.0"?><project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>c</groupId><artifactId>a</artifactId><version>1</version>
  <properties><maven.compiler.release>17</maven.compiler.release></properties>
</project>`
    );
    const d = discover(dir);
    assert.equal(d.framework, 'none');
    assert.equal(d.language, 'java');
  });

  it('tecnologia NOT_IMPLEMENTED (MAUI) → NOT_IMPLEMENTED', () => {
    const dir = tmpDir('disc-maui-');
    fs.writeFileSync(
      path.join(dir, 'App.csproj'),
      `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <UseMaui>true</UseMaui>
  </PropertyGroup>
</Project>`
    );
    assertFailsWith(() => discover(dir), ERROR_CODES.NOT_IMPLEMENTED);
  });
});
