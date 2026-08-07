'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { computeFingerprint, hashFiles } = require('../../internal/utils/fingerprint/fingerprint');

describe('fingerprint', () => {
  it('e deterministico para os mesmos arquivos', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-'));
    fs.writeFileSync(path.join(dir, 'pom.xml'), '<project><packaging>jar</packaging></project>');
    const a = computeFingerprint(dir, { buildSystem: 'maven', language: 'java' });
    const b = computeFingerprint(dir, { buildSystem: 'maven', language: 'java' });
    assert.equal(a.value, b.value);
    assert.equal(a.algorithm, 'sha256');
  });

  it('muda quando arquivo muda', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-'));
    fs.writeFileSync(path.join(dir, 'pom.xml'), 'v1');
    const a = computeFingerprint(dir, { buildSystem: 'maven' });
    fs.writeFileSync(path.join(dir, 'pom.xml'), 'v2');
    const b = computeFingerprint(dir, { buildSystem: 'maven' });
    assert.notEqual(a.value, b.value);
  });

  it('ordem dos arquivos nao altera o hash', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-'));
    fs.writeFileSync(path.join(dir, 'a.txt'), 'a');
    fs.writeFileSync(path.join(dir, 'b.txt'), 'b');
    const h1 = hashFiles(dir, ['b.txt', 'a.txt']);
    const h2 = hashFiles(dir, ['a.txt', 'b.txt']);
    assert.equal(h1, h2);
  });
});
