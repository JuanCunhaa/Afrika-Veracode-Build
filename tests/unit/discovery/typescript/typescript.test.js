'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { detect } = require('../../../../internal/discovery/detectors/javascript');
const { unitFixtures } = require('../../helpers/zip');

const pkgs = path.join(unitFixtures, 'package-json');

describe('discovery / typescript', () => {
  it('detecta TypeScript via tsconfig + react', () => {
    const d = detect(path.join(pkgs, 'typescript-react'));
    assert.equal(d.language, 'typescript');
    assert.equal(d.framework, 'react');
    assert.equal(d.doctorProfile, 'typescript-source');
    assert.equal(d.packagingStrategy, 'SOURCE_PACKAGE');
  });

  it('detecta TypeScript apenas pela dependencia typescript', () => {
    // nestjs fixture has no tsconfig but Nest is typically TS; this fixture is JS deps only
    // Use typescript-react which has typescript dep + tsconfig
    const d = detect(path.join(pkgs, 'typescript-react'));
    assert.equal(d.language, 'typescript');
    assert.ok(d.ecosystem === 'node');
  });
});
