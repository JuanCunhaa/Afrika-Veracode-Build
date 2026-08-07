'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  computeFingerprint,
  hashFiles,
  collectManifestFiles
} = require('../../../internal/utils/fingerprint/fingerprint');

describe('fingerprint', () => {
  it('e deterministico para pom.xml + mvnw', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-maven-'));
    fs.writeFileSync(path.join(dir, 'pom.xml'), '<project><packaging>jar</packaging></project>');
    fs.writeFileSync(path.join(dir, 'mvnw'), '#!/bin/sh\n');
    const a = computeFingerprint(dir, { buildSystem: 'maven', language: 'java' });
    const b = computeFingerprint(dir, { buildSystem: 'maven', language: 'java' });
    assert.equal(a.value, b.value);
    assert.equal(a.algorithm, 'sha256');
    assert.ok(a.files.includes('pom.xml'));
    assert.ok(a.files.includes('mvnw'));
  });

  it('muda quando pom.xml muda', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-chg-'));
    fs.writeFileSync(path.join(dir, 'pom.xml'), 'v1');
    const a = computeFingerprint(dir, { buildSystem: 'maven' });
    fs.writeFileSync(path.join(dir, 'pom.xml'), 'v2');
    const b = computeFingerprint(dir, { buildSystem: 'maven' });
    assert.notEqual(a.value, b.value);
  });

  it('ordem dos arquivos nao altera o hash', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-ord-'));
    fs.writeFileSync(path.join(dir, 'a.txt'), 'a');
    fs.writeFileSync(path.join(dir, 'b.txt'), 'b');
    assert.equal(hashFiles(dir, ['b.txt', 'a.txt']), hashFiles(dir, ['a.txt', 'b.txt']));
  });

  it('README.md e docs nao entram no fingerprint maven', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-irr-'));
    fs.writeFileSync(path.join(dir, 'pom.xml'), '<project/>');
    const before = computeFingerprint(dir, { buildSystem: 'maven' });
    fs.writeFileSync(path.join(dir, 'README.md'), '# docs change');
    fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'docs', 'guide.md'), 'irrelevant');
    const after = computeFingerprint(dir, { buildSystem: 'maven' });
    assert.equal(before.value, after.value);
    assert.ok(!before.files.includes('README.md'));
  });

  it('coleta manifests javascript incluindo lock e nvmrc', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-js-'));
    fs.writeFileSync(path.join(dir, 'package.json'), '{}');
    fs.writeFileSync(path.join(dir, 'package-lock.json'), '{}');
    fs.writeFileSync(path.join(dir, '.nvmrc'), '20\n');
    const files = collectManifestFiles(dir, { language: 'javascript', buildSystem: 'npm' });
    assert.ok(files.includes('package.json'));
    assert.ok(files.includes('package-lock.json'));
    assert.ok(files.includes('.nvmrc'));
  });

  it('coleta gradle wrapper properties', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-gradle-'));
    fs.writeFileSync(path.join(dir, 'build.gradle'), 'plugins { id "java" }');
    fs.mkdirSync(path.join(dir, 'gradle', 'wrapper'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'gradle', 'wrapper', 'gradle-wrapper.properties'), 'x=1');
    const fp = computeFingerprint(dir, { buildSystem: 'gradle' });
    assert.ok(fp.files.includes('build.gradle'));
    assert.ok(fp.files.some((f) => f.includes('gradle-wrapper.properties')));
  });

  it('coleta csproj para fingerprint dotnet', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-dotnet-'));
    fs.writeFileSync(path.join(dir, 'App.csproj'), '<Project Sdk="Microsoft.NET.Sdk" />');
    const files = collectManifestFiles(dir, { language: 'dotnet', buildSystem: 'dotnet' });
    assert.ok(files.some((f) => f.endsWith('.csproj')));
  });
});
