'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { resolveArtifactPatterns } = require('../../../internal/utils/artifact/artifact');

describe('resolveArtifactPatterns', () => {
  /** @type {string} */
  let root;

  before(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'avb-art-'));
    fs.mkdirSync(path.join(root, 'core', 'target'), { recursive: true });
    fs.mkdirSync(path.join(root, 'api', 'target'), { recursive: true });
    fs.mkdirSync(path.join(root, 'target'), { recursive: true });
    fs.writeFileSync(path.join(root, 'core', 'target', 'core-1.0.jar'), 'jar');
    fs.writeFileSync(path.join(root, 'core', 'target', 'core-1.0-sources.jar'), 'src');
    fs.writeFileSync(path.join(root, 'api', 'target', 'api-1.0.jar'), 'jar');
    fs.writeFileSync(path.join(root, 'target', 'parent-1.0.jar'), 'jar');
  });

  after(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('resolves plain target/*.jar', () => {
    const files = resolveArtifactPatterns(root, ['target/*.jar']);
    assert.equal(files.length, 1);
    assert.ok(files[0].endsWith(`${path.sep}parent-1.0.jar`));
  });

  it('expands */target/*.jar across modules', () => {
    const files = resolveArtifactPatterns(root, ['*/target/*.jar']).sort();
    assert.equal(files.length, 2);
    assert.ok(files.some((f) => f.endsWith(`${path.sep}core-1.0.jar`)));
    assert.ok(files.some((f) => f.endsWith(`${path.sep}api-1.0.jar`)));
    assert.ok(!files.some((f) => f.includes('-sources.jar')));
  });

  it('resolves concrete module/target/*.jar', () => {
    const files = resolveArtifactPatterns(root, ['core/target/*.jar']);
    assert.equal(files.length, 1);
    assert.ok(files[0].endsWith(`${path.sep}core-1.0.jar`));
  });
});
