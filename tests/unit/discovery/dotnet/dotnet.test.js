'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const {
  detect,
  classifyProject,
  extractTargetFrameworks,
  isTestProject
} = require('../../../../internal/discovery/detectors/dotnet');
const { unitFixtures } = require('../../helpers/zip');
const fs = require('fs');

const projects = path.join(unitFixtures, 'dotnet-projects');
const samples = path.join(unitFixtures, 'dotnet');

describe('discovery / dotnet helpers', () => {
  it('extrai TargetFramework e TargetFrameworks', () => {
    assert.deepEqual(extractTargetFrameworks(fs.readFileSync(path.join(samples, 'net8-console.csproj'), 'utf8')), [
      'net8.0'
    ]);
    assert.deepEqual(extractTargetFrameworks(fs.readFileSync(path.join(samples, 'multi-tfm.csproj'), 'utf8')), [
      'net6.0',
      'net8.0'
    ]);
  });

  it('extrai TargetFrameworkVersion legado para net48', () => {
    assert.deepEqual(extractTargetFrameworks(fs.readFileSync(path.join(samples, 'net48.csproj'), 'utf8')), ['net48']);
  });

  it('classifica project types suportados', () => {
    assert.equal(
      classifyProject(fs.readFileSync(path.join(samples, 'blazor-wasm.csproj'), 'utf8'), 'blazor-wasm.csproj'),
      'blazor-wasm'
    );
    assert.equal(
      classifyProject(fs.readFileSync(path.join(samples, 'azure-functions.csproj'), 'utf8'), 'azure-functions.csproj'),
      'azure-functions'
    );
    assert.equal(
      classifyProject(fs.readFileSync(path.join(samples, 'aspnet-core.csproj'), 'utf8'), 'aspnet-core.csproj'),
      'aspnet-core'
    );
    assert.equal(
      classifyProject(fs.readFileSync(path.join(samples, 'winforms.csproj'), 'utf8'), 'winforms.csproj'),
      'winforms'
    );
    assert.equal(classifyProject(fs.readFileSync(path.join(samples, 'wpf.csproj'), 'utf8'), 'wpf.csproj'), 'wpf');
    assert.equal(
      classifyProject(fs.readFileSync(path.join(samples, 'net8-console.csproj'), 'utf8'), 'net8-console.csproj'),
      'console'
    );
    assert.equal(
      classifyProject(fs.readFileSync(path.join(samples, 'class-library.csproj'), 'utf8'), 'class-library.csproj'),
      'class-library'
    );
  });

  it('identifica IsTestProject', () => {
    assert.equal(isTestProject(fs.readFileSync(path.join(samples, 'test-project.csproj'), 'utf8')), true);
    assert.equal(isTestProject(fs.readFileSync(path.join(samples, 'net8-console.csproj'), 'utf8')), false);
  });
});

describe('discovery / dotnet detect', () => {
  it('detecta net6 console moderno', () => {
    const d = detect(path.join(projects, 'net6-console'));
    assert.equal(d.language, 'dotnet');
    assert.equal(d.framework, 'dotnet-modern');
    assert.equal(d.runtimeVersion, 'net6.0');
    assert.equal(d.buildSystem, 'dotnet');
    assert.equal(d.projectType, 'console');
    assert.equal(d.packagingStrategy, 'BUILD_REQUIRED');
  });

  it('detecta net7 e net8 console', () => {
    assert.equal(detect(path.join(projects, 'net7-console')).runtimeVersion, 'net7.0');
    const d = detect(path.join(projects, 'net8-console'));
    assert.equal(d.runtimeVersion, 'net8.0');
    assert.equal(d.confidence, 'HIGH');
  });

  it('detecta net8/net9/net10 webapi como aspnet-core', () => {
    for (const name of ['net8-webapi', 'net9-webapi', 'net10-webapi']) {
      const d = detect(path.join(projects, name));
      assert.equal(d.projectType, 'aspnet-core');
      assert.equal(d.framework, 'aspnet-core');
      assert.equal(d.doctorProfile, 'dotnet-modern');
    }
  });

  it('detecta .NET Framework 4.8', () => {
    const d = detect(path.join(projects, 'net48'));
    assert.equal(d.framework, 'dotnet-framework');
    assert.equal(d.buildSystem, 'msbuild');
    assert.equal(d.runtimeVersion, 'net48');
    assert.equal(d.doctorProfile, 'dotnet-framework');
  });

  it('detecta Blazor WASM', () => {
    const d = detect(path.join(projects, 'blazor-wasm'));
    assert.equal(d.projectType, 'blazor-wasm');
    assert.equal(d.framework, 'blazor-wasm');
    assert.equal(d.doctorProfile, 'dotnet-blazor-wasm');
  });

  it('detecta Azure Functions', () => {
    const d = detect(path.join(projects, 'azure-functions'));
    assert.equal(d.projectType, 'azure-functions');
    assert.equal(d.framework, 'dotnet-modern');
  });

  it('detecta VB.NET', () => {
    const d = detect(path.join(projects, 'vbnet'));
    assert.equal(d.language, 'dotnet');
    assert.equal(d.runtimeVersion, 'net8.0');
    assert.equal(d.projectType, 'console');
  });

  it('detecta WinForms e WPF', () => {
    assert.equal(detect(path.join(projects, 'winforms')).projectType, 'winforms');
    assert.equal(detect(path.join(projects, 'wpf')).projectType, 'wpf');
  });

  it('detecta multi-TFM', () => {
    const d = detect(path.join(projects, 'multi-tfm'));
    assert.deepEqual(d.targetFrameworks, ['net6.0', 'net8.0']);
    assert.equal(d.runtimeVersion, 'net6.0');
  });

  it('prefere projeto nao-teste quando ha Ambos', () => {
    const d = detect(path.join(projects, 'app-with-test'));
    assert.equal(d.ambiguous, false);
    assert.equal(d.projectType, 'console');
    assert.ok(d.testProjects.some((p) => /Tests/i.test(p)));
  });
});
