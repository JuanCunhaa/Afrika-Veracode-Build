'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { detect } = require('../../../../internal/discovery/detectors/javascript');
const { unitFixtures } = require('../../helpers/zip');

const pkgs = path.join(unitFixtures, 'package-json');

describe('discovery / javascript', () => {
  it('detecta JavaScript puro', () => {
    const d = detect(path.join(pkgs, 'javascript-plain'));
    assert.equal(d.language, 'javascript');
    assert.equal(d.ecosystem, 'node');
    assert.equal(d.framework, 'none');
    assert.equal(d.packagingStrategy, 'SOURCE_PACKAGE');
    assert.equal(d.doctorProfile, 'javascript-source');
    assert.equal(d.confidence, 'MEDIUM');
  });

  it('detecta Express com npm e engines.node', () => {
    const d = detect(path.join(pkgs, 'javascript-express'));
    assert.equal(d.language, 'javascript');
    assert.equal(d.framework, 'express');
    assert.equal(d.packageManager, 'npm');
    assert.equal(d.runtimeVersion, '20.11.0');
    assert.equal(d.confidence, 'HIGH');
    assert.equal(d.hasLockfile, true);
  });

  it('detecta Next.js (prioridade sobre react)', () => {
    const d = detect(path.join(pkgs, 'nextjs'));
    assert.equal(d.framework, 'next');
    assert.equal(d.packageManager, 'npm');
  });

  it('detecta NestJS com yarn', () => {
    const d = detect(path.join(pkgs, 'nestjs'));
    assert.equal(d.framework, 'nestjs');
    assert.equal(d.packageManager, 'yarn');
  });

  it('detecta Angular com pnpm', () => {
    const d = detect(path.join(pkgs, 'angular'));
    assert.equal(d.framework, 'angular');
    assert.equal(d.packageManager, 'pnpm');
  });

  it('detecta Vue com npm-shrinkwrap', () => {
    const d = detect(path.join(pkgs, 'vue'));
    assert.equal(d.framework, 'vue');
    assert.equal(d.packageManager, 'npm');
  });

  it('runtime via .nvmrc', () => {
    const d = detect(path.join(pkgs, 'node-from-nvmrc'));
    assert.equal(d.runtimeVersion, '18.20.0');
  });

  it('runtime via .node-version', () => {
    const d = detect(path.join(pkgs, 'node-from-node-version'));
    assert.equal(d.runtimeVersion, '22.5.0');
  });

  it('engines.node tem prioridade sobre .nvmrc', () => {
    const d = detect(path.join(pkgs, 'engines-priority'));
    // engines vence .nvmrc (18); parser pode preservar o range literal
    assert.notEqual(d.runtimeVersion, '18.0.0');
    assert.match(String(d.runtimeVersion), /20/);
  });

  it('sem lockfile gera warning e confidence MEDIUM', () => {
    const d = detect(path.join(pkgs, 'no-lock'));
    assert.equal(d.hasLockfile, false);
    assert.equal(d.confidence, 'MEDIUM');
    assert.ok(d.warnings.length > 0);
  });

  it('nao infer framework pelo nome da pasta', () => {
    const d = detect(path.join(pkgs, 'javascript-plain'));
    assert.equal(d.framework, 'none');
  });
});
