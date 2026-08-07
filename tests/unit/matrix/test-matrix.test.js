'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { load, filterEntries } = require('../../../scripts/resolve-test-matrix');

describe('test-matrix source of truth', () => {
  const doc = load();

  it('defines pr/full/release profiles', () => {
    assert.ok(doc.profiles.pr);
    assert.ok(doc.profiles.full);
    assert.ok(doc.profiles.release);
    assert.equal(doc.profiles.pr.failFast, true);
    assert.equal(doc.profiles.full.failFast, false);
  });

  it('PR matrix is a strict subset of full for java maven basics', () => {
    const pr = filterEntries(doc.javaMaven, 'pr').map((e) => e.case);
    const full = filterEntries(doc.javaMaven, 'full').map((e) => e.case);
    for (const c of pr) assert.ok(full.includes(c), `${c} missing from full`);
    assert.ok(pr.length < full.length);
    assert.ok(pr.includes('java17-basic'));
    assert.ok(pr.includes('java21-basic'));
    assert.ok(!pr.includes('java8-basic'));
  });

  it('experimental entries never appear alone as stable without flag', () => {
    const all = [...doc.javaMaven, ...doc.javaGradle, ...doc.dotnetModern];
    for (const e of all) {
      if (e.stability === 'experimental') {
        assert.ok(e.profiles.includes('full') || e.profiles.includes('release'));
      }
    }
  });

  it('dotnet framework is windows-only', () => {
    for (const e of doc.dotnetFramework) {
      assert.equal(e.os, 'windows-latest');
    }
  });

  it('pinned actions use full SHA refs', () => {
    for (const key of ['checkout', 'setupNode', 'setupJava', 'setupDotnet', 'setupGradle']) {
      const ref = doc.pinnedActions[key].split('@')[1];
      assert.match(ref, /^[0-9a-f]{40}$/i);
    }
  });

  it('supportTable documents release requirement', () => {
    assert.ok((doc.supportTable || []).length >= 4);
    for (const row of doc.supportTable) {
      assert.ok(row.technology);
      assert.ok(row.stability);
    }
  });
});
