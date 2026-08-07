'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { doctorJavaScript } = require('../../internal/doctor/javascript/doctor');
const { createZip } = require('../../internal/utils/artifact/artifact');

describe('doctor javascript', () => {
  it('marca INVALID quando so ha minificado', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-js-'));
    fs.writeFileSync(path.join(dir, 'app.min.js'), 'function a(){}');
    fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"x"}');
    const zip = path.join(dir, 'pack.zip');
    createZip([path.join(dir, 'app.min.js'), path.join(dir, 'package.json')], zip);
    const result = doctorJavaScript(zip, { language: 'javascript' });
    assert.equal(result.status, 'INVALID');
  });

  it('aceita source legivel com package.json e lock', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-js-'));
    fs.writeFileSync(path.join(dir, 'index.js'), 'module.exports=1');
    fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"x"}');
    fs.writeFileSync(path.join(dir, 'package-lock.json'), '{"lockfileVersion":3}');
    const zip = path.join(dir, 'pack.zip');
    createZip([path.join(dir, 'index.js'), path.join(dir, 'package.json'), path.join(dir, 'package-lock.json')], zip);
    const result = doctorJavaScript(zip, { language: 'javascript' });
    assert.ok(result.status === 'READY' || result.status === 'READY_WITH_WARNINGS');
  });
});
