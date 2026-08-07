'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { main: jsBuilderMain } = require('../../../internal/builder/javascript');
const { ERROR_CODES } = require('../../../internal/utils/errors/errors');
const { assertFailsWith, tmpDir, zipFromFiles } = require('../helpers/assert');

function withEnv(vars, fn) {
  const saved = {};
  for (const key of Object.keys(vars)) {
    saved[key] = process.env[key];
    if (vars[key] === undefined || vars[key] === null) delete process.env[key];
    else process.env[key] = String(vars[key]);
  }
  try {
    return fn();
  } finally {
    for (const key of Object.keys(vars)) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

describe('negative / builder', () => {
  it('JS builder sem package.json → PROJECT_NOT_FOUND', () => {
    const dir = tmpDir('bld-js-');
    const out = path.join(dir, 'out');
    fs.mkdirSync(out);
    const planPath = path.join(dir, 'plan.json');
    fs.writeFileSync(
      planPath,
      JSON.stringify({
        schemaVersion: 1,
        language: 'javascript',
        projectPath: '.',
        strategy: 'SOURCE_PACKAGE'
      })
    );
    const src = path.join(dir, 'src');
    fs.mkdirSync(src);
    fs.writeFileSync(path.join(src, 'index.js'), 'module.exports=1');

    withEnv(
      {
        BUILD_PLAN_PATH: planPath,
        SOURCE: src,
        OUTPUT_DIR: out,
        BUILD_COMMAND: ''
      },
      () => assertFailsWith(() => jsBuilderMain(), ERROR_CODES.PROJECT_NOT_FOUND)
    );
  });

  it('JS builder rejeita build_command de producao → BUILD_FAILED (codigo explicito)', () => {
    const dir = tmpDir('bld-js-prod-');
    const out = path.join(dir, 'out');
    fs.mkdirSync(out);
    const src = path.join(dir, 'src');
    fs.mkdirSync(src);
    fs.writeFileSync(path.join(src, 'package.json'), '{"name":"x"}');
    const planPath = path.join(dir, 'plan.json');
    fs.writeFileSync(
      planPath,
      JSON.stringify({
        schemaVersion: 1,
        language: 'javascript',
        projectPath: '.',
        strategy: 'SOURCE_PACKAGE'
      })
    );

    withEnv(
      {
        BUILD_PLAN_PATH: planPath,
        SOURCE: src,
        OUTPUT_DIR: out,
        BUILD_COMMAND: 'npm run build'
      },
      () => assertFailsWith(() => jsBuilderMain(), ERROR_CODES.BUILD_FAILED)
    );
  });

  it('Doctor INVALID mapeia para DOCTOR_FAILED no CLI', () => {
    const { main: doctorMain } = require('../../../internal/doctor');
    const { zip } = zipFromFiles({ 'app.min.js': 'x()', 'package.json': '{}' });
    const out = tmpDir('doc-cli-');

    withEnv(
      {
        ARTIFACT_PATH: zip,
        OUTPUT_DIR: out,
        DOCTOR_MODE: 'standard',
        DOCTOR_PROFILE: 'javascript-source',
        BUILD_PLAN_PATH: ''
      },
      () => {
        assertFailsWith(() => doctorMain(), ERROR_CODES.DOCTOR_FAILED);
        const result = JSON.parse(fs.readFileSync(path.join(out, 'doctor-result.json'), 'utf8'));
        assert.equal(result.status, 'INVALID');
      }
    );
  });
});
