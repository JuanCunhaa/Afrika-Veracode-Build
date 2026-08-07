'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { doctorJava } = require('../../../internal/doctor/java/doctor');
const { doctorJavaScript } = require('../../../internal/doctor/javascript/doctor');
const { doctorDotnet } = require('../../../internal/doctor/dotnet/doctor');
const { finalizeStatus } = require('../../../internal/doctor/common');
const { zipFromFiles } = require('../helpers/zip');
const path = require('path');
const os = require('os');

describe('doctor / rules', () => {
  it('JAVA_BYTECODE_PRESENT passa com .class', () => {
    const { zip } = zipFromFiles({ 'com/example/App.class': Buffer.from([0xca, 0xfe, 0xba, 0xbe]) });
    const result = doctorJava(zip, { doctorProfile: 'java-compiled' });
    const check = result.checks.find((c) => c.id === 'JAVA_BYTECODE_PRESENT');
    assert.ok(check);
    assert.equal(check.status, 'PASS');
  });

  it('JAVA_BYTECODE_PRESENT falha sem bytecode', () => {
    const { zip } = zipFromFiles({ 'README.txt': 'no classes here' });
    const result = doctorJava(zip, { doctorProfile: 'java-compiled' });
    const check = result.checks.find((c) => c.id === 'JAVA_BYTECODE_PRESENT');
    assert.equal(check.status, 'FAIL');
    assert.equal(result.status, 'INVALID');
  });

  it('JAVA_DEBUG_INFORMATION emite WARN quando ha .class', () => {
    const { zip } = zipFromFiles({ 'App.class': Buffer.from([0xca, 0xfe, 0xba, 0xbe]) });
    const result = doctorJava(zip, { doctorProfile: 'java-compiled' });
    const check = result.checks.find((c) => c.id === 'JAVA_DEBUG_INFORMATION');
    assert.ok(check);
    assert.equal(check.status, 'WARN');
  });

  it('JAVA_SOURCE_PRESENT em modo source', () => {
    const { zip } = zipFromFiles({ 'src/App.java': 'class App {}' });
    const result = doctorJava(zip, { doctorProfile: 'java-source', javaPackageMode: 'source' });
    const check = result.checks.find((c) => c.id === 'JAVA_SOURCE_PRESENT');
    assert.equal(check.status, 'PASS');
  });

  it('JS_SOURCE_READABLE falha para apenas minificado', () => {
    const { zip } = zipFromFiles({
      'app.min.js': 'function a(){}',
      'package.json': '{"name":"x"}'
    });
    const result = doctorJavaScript(zip, { language: 'javascript' });
    const check = result.checks.find((c) => c.id === 'JS_SOURCE_READABLE');
    assert.equal(check.status, 'FAIL');
    assert.equal(result.status, 'INVALID');
  });

  it('JS_SOURCE_READABLE + JS_LOCKFILE_PRESENT + JS_NODE_MODULES_EXCLUDED', () => {
    const { zip } = zipFromFiles({
      'index.js': 'module.exports = 1;',
      'package.json': '{"name":"x"}',
      'package-lock.json': '{"lockfileVersion":3}'
    });
    const result = doctorJavaScript(zip, { language: 'javascript' });
    assert.equal(result.checks.find((c) => c.id === 'JS_SOURCE_READABLE').status, 'PASS');
    assert.equal(result.checks.find((c) => c.id === 'JS_LOCKFILE_PRESENT').status, 'PASS');
    assert.equal(result.checks.find((c) => c.id === 'JS_NODE_MODULES_EXCLUDED').status, 'PASS');
    assert.ok(result.status === 'READY' || result.status === 'READY_WITH_WARNINGS');
  });

  it('JS_NODE_MODULES_EXCLUDED WARN quando node_modules presente', () => {
    const { zip } = zipFromFiles({
      'index.js': 'module.exports = 1;',
      'package.json': '{"name":"x"}',
      'package-lock.json': '{}',
      'node_modules/leftpad/index.js': 'module.exports=1'
    });
    const result = doctorJavaScript(zip, { language: 'javascript' });
    const check = result.checks.find((c) => c.id === 'JS_NODE_MODULES_EXCLUDED');
    assert.equal(check.status, 'WARN');
  });

  it('DOTNET_ASSEMBLY_PRESENT e DOTNET_PDB_RECOMMENDED', () => {
    const { zip } = zipFromFiles({
      'App.dll': Buffer.alloc(16, 1),
      'App.pdb': Buffer.alloc(8, 2),
      'App.deps.json': '{"runtimeTarget":{}}'
    });
    const result = doctorDotnet(zip, { framework: 'dotnet-modern', buildSystem: 'dotnet' });
    assert.equal(result.checks.find((c) => c.id === 'DOTNET_ASSEMBLY_PRESENT').status, 'PASS');
    assert.equal(result.checks.find((c) => c.id === 'DOTNET_PDB_RECOMMENDED').status, 'PASS');
    assert.equal(result.checks.find((c) => c.id === 'DOTNET_DEPS_JSON').status, 'PASS');
  });

  it('DOTNET_PDB_RECOMMENDED WARN sem pdb; DOTNET_DEPS_JSON WARN sem deps', () => {
    const { zip } = zipFromFiles({ 'App.dll': Buffer.alloc(16, 1) });
    const result = doctorDotnet(zip, { framework: 'dotnet-modern', buildSystem: 'dotnet' });
    assert.equal(result.checks.find((c) => c.id === 'DOTNET_PDB_RECOMMENDED').status, 'WARN');
    assert.equal(result.checks.find((c) => c.id === 'DOTNET_DEPS_JSON').status, 'WARN');
  });

  it('DOTNET_DEPS_JSON WARN tipico para blazor-wasm', () => {
    const { zip } = zipFromFiles({ 'App.dll': Buffer.alloc(16, 1), 'App.pdb': Buffer.alloc(4, 1) });
    const result = doctorDotnet(zip, { framework: 'blazor-wasm', buildSystem: 'dotnet' });
    const deps = result.checks.find((c) => c.id === 'DOTNET_DEPS_JSON');
    assert.equal(deps.status, 'WARN');
    assert.match(deps.message, /Blazor/i);
  });

  it('ARTIFACT_EXISTS FAIL quando arquivo ausente', () => {
    const result = doctorJava(path.join(os.tmpdir(), 'missing-artifact-avb.zip'), { doctorProfile: 'java-compiled' });
    assert.equal(result.checks.find((c) => c.id === 'ARTIFACT_EXISTS').status, 'FAIL');
    assert.equal(result.status, 'INVALID');
  });

  it('finalizeStatus agrega FAIL/WARN/PASS', () => {
    assert.equal(finalizeStatus([{ status: 'FAIL' }]), 'INVALID');
    assert.equal(finalizeStatus([{ status: 'WARN' }]), 'READY_WITH_WARNINGS');
    assert.equal(finalizeStatus([{ status: 'PASS' }]), 'READY');
    assert.equal(finalizeStatus([]), 'UNKNOWN');
  });
});
