'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { doctorDotnet } = require('../../../internal/doctor/dotnet/doctor');
const { zipFromFiles } = require('../helpers/assert');

describe('negative / doctor / dotnet', () => {
  it('ZIP sem DLL/EXE → INVALID (DOTNET_ASSEMBLY_PRESENT FAIL)', () => {
    const { zip } = zipFromFiles({
      'readme.txt': 'no assemblies',
      'App.deps.json': '{"runtimeTarget":{}}'
    });
    const result = doctorDotnet(zip, { framework: 'dotnet-modern', buildSystem: 'dotnet' });
    assert.equal(result.status, 'INVALID');
    assert.equal(result.checks.find((c) => c.id === 'DOTNET_ASSEMBLY_PRESENT').status, 'FAIL');
  });

  it('DLL sem PDB → READY_WITH_WARNINGS (DOTNET_PDB_RECOMMENDED WARN, nao INVALID)', () => {
    // PDB e recomendacao Veracode, nao requisito duro
    const { zip } = zipFromFiles({
      'App.dll': Buffer.alloc(32, 1),
      'App.deps.json': '{"runtimeTarget":{}}'
    });
    const result = doctorDotnet(zip, { framework: 'dotnet-modern', buildSystem: 'dotnet' });
    assert.notEqual(result.status, 'INVALID');
    assert.equal(result.checks.find((c) => c.id === 'DOTNET_PDB_RECOMMENDED').status, 'WARN');
    assert.ok(result.status === 'READY_WITH_WARNINGS' || result.status === 'READY');
  });

  it('deps.json ausente em moderno → WARN DOTNET_DEPS_JSON (nao INVALID)', () => {
    const { zip } = zipFromFiles({
      'App.dll': Buffer.alloc(32, 1),
      'App.pdb': Buffer.alloc(8, 2)
    });
    const result = doctorDotnet(zip, { framework: 'dotnet-modern', buildSystem: 'dotnet' });
    assert.notEqual(result.status, 'INVALID');
    assert.equal(result.checks.find((c) => c.id === 'DOTNET_DEPS_JSON').status, 'WARN');
  });

  it('Application.Tests.dll no artifact → DOTNET_NO_TEST_ASSEMBLIES WARN', () => {
    const { zip } = zipFromFiles({
      'App.dll': Buffer.alloc(16, 1),
      'App.pdb': Buffer.alloc(8, 1),
      'App.deps.json': '{}',
      'Application.Tests.dll': Buffer.alloc(16, 3)
    });
    const result = doctorDotnet(zip, { framework: 'dotnet-modern', buildSystem: 'dotnet' });
    const tests = result.checks.find((c) => c.id === 'DOTNET_NO_TEST_ASSEMBLIES');
    assert.ok(tests);
    assert.equal(tests.status, 'WARN');
    assert.notEqual(result.status, 'INVALID');
  });

  it('SCD hints (hostfxr) → INVALID (DOTNET_NO_SCD FAIL)', () => {
    const { zip } = zipFromFiles({
      'App.dll': Buffer.alloc(16, 1),
      'hostfxr.dll': Buffer.alloc(16, 9)
    });
    const result = doctorDotnet(zip, { framework: 'dotnet-modern', buildSystem: 'dotnet' });
    assert.equal(result.status, 'INVALID');
    assert.equal(result.checks.find((c) => c.id === 'DOTNET_NO_SCD').status, 'FAIL');
  });

  it('DLL corrompida / arch mismatch: MVP nao valida PE — nao inventa FAIL', () => {
    // Documenta gap: Doctor atual so checa extensao .dll/.exe, nao formato PE nem arquitetura.
    const { zip } = zipFromFiles({
      'App.dll': Buffer.from('NOT_A_PE_ASSEMBLY'),
      'App.pdb': Buffer.alloc(4, 1),
      'App.deps.json': '{}'
    });
    const result = doctorDotnet(zip, { framework: 'dotnet-modern', buildSystem: 'dotnet' });
    assert.equal(result.checks.find((c) => c.id === 'DOTNET_ASSEMBLY_PRESENT').status, 'PASS');
  });
});
