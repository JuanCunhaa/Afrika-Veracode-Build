'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { doctorJavaScript } = require('../../../internal/doctor/javascript/doctor');
const { zipFromFiles } = require('../helpers/assert');

describe('negative / doctor / javascript-typescript', () => {
  it('apenas bundle minificado → INVALID (JS_SOURCE_READABLE FAIL)', () => {
    const { zip } = zipFromFiles({
      'dist/app.min.js': 'function a(b){return b}',
      'package.json': '{"name":"x"}'
    });
    const result = doctorJavaScript(zip, { language: 'javascript' });
    assert.equal(result.status, 'INVALID');
    assert.equal(result.checks.find((c) => c.id === 'JS_SOURCE_READABLE').status, 'FAIL');
  });

  it('node_modules incluido com lockfile → READY_WITH_WARNINGS (JS_NODE_MODULES_EXCLUDED WARN)', () => {
    // Catalogo: severity=warning (recomendacao Veracode), nao error
    const { zip } = zipFromFiles({
      'index.js': 'module.exports = 1;',
      'package.json': '{"name":"x"}',
      'package-lock.json': '{"lockfileVersion":3}',
      'node_modules/leftpad/index.js': 'module.exports=x=>'
    });
    const result = doctorJavaScript(zip, { language: 'javascript' });
    assert.notEqual(result.status, 'INVALID');
    assert.equal(result.checks.find((c) => c.id === 'JS_NODE_MODULES_EXCLUDED').status, 'WARN');
    assert.equal(result.status, 'READY_WITH_WARNINGS');
  });

  it('TypeScript plan com apenas dist/*.js → INVALID (JS_NO_DIST_ONLY FAIL)', () => {
    const { zip } = zipFromFiles({
      'dist/app.js': 'exports.x=1;',
      'package.json': '{"name":"ts-app","devDependencies":{"typescript":"5.0.0"}}'
    });
    const result = doctorJavaScript(zip, { language: 'typescript' });
    assert.equal(result.status, 'INVALID');
    assert.equal(result.checks.find((c) => c.id === 'JS_NO_DIST_ONLY').status, 'FAIL');
    const ts = result.checks.find((c) => c.id === 'TS_SOURCE_PRESERVED');
    assert.ok(ts);
    assert.equal(ts.status, 'WARN');
  });

  it('source map presente → JS_SOURCEMAP_CONTENT WARN (MVP nao inspeciona sourcesContent byte-a-byte)', () => {
    // Documentacao exige sources+sourcesContent; Doctor atual emite WARN generico quando ha .map
    const { zip } = zipFromFiles({
      'index.js': 'module.exports=1;',
      'index.js.map': JSON.stringify({ version: 3, file: 'index.js', sources: [], mappings: '' }),
      'package.json': '{"name":"x"}',
      'package-lock.json': '{}'
    });
    const result = doctorJavaScript(zip, { language: 'javascript' });
    const map = result.checks.find((c) => c.id === 'JS_SOURCEMAP_CONTENT');
    assert.ok(map);
    assert.equal(map.status, 'WARN');
    assert.notEqual(result.status, 'INVALID');
  });
});
