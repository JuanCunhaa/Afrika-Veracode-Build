'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  assertDoctorAcceptsBuilderArtifact,
  failContract,
  ALLOWED_WARN_IDS,
  ERROR_CODES
} = require('../../contract/builder-doctor/lib/contract');
const { withGradleInitScript, INIT_SCRIPT } = require('../../../internal/builder/java-gradle');

describe('Builder → Doctor contract helpers', () => {
  it('BUILDER_DOCTOR_CONTRACT_BROKEN when Doctor INVALID after Builder success', () => {
    assert.throws(
      () =>
        assertDoctorAcceptsBuilderArtifact({
          language: 'java',
          runtime: '17',
          builder: 'java-maven',
          artifact: '/tmp/analysisPack.zip',
          doctor: {
            status: 'INVALID',
            checks: [{ id: 'JAVA_BYTECODE_PRESENT', status: 'FAIL', message: 'missing' }]
          }
        }),
      (err) => err && err.code === ERROR_CODES.BUILDER_DOCTOR_CONTRACT_BROKEN
    );
  });

  it('accepts READY and READY_WITH_WARNINGS with documented warns', () => {
    assert.doesNotThrow(() =>
      assertDoctorAcceptsBuilderArtifact({
        language: 'java',
        builder: 'java-maven',
        artifact: 'x.zip',
        doctor: {
          status: 'READY_WITH_WARNINGS',
          checks: [{ id: 'JAVA_DEBUG_INFORMATION', status: 'WARN', message: 'debug recommended' }]
        }
      })
    );
    assert.ok(ALLOWED_WARN_IDS.has('JAVA_DEBUG_INFORMATION'));
    assert.ok(ALLOWED_WARN_IDS.has('DOTNET_PDB_RECOMMENDED'));
  });

  it('failContract surfaces language/runtime/builder/failed rules', () => {
    try {
      failContract({
        language: 'dotnet',
        runtime: 'net8.0',
        builder: 'dotnet',
        artifact: 'a.zip',
        doctor: {
          status: 'INVALID',
          checks: [{ id: 'DOTNET_ASSEMBLIES', status: 'FAIL', message: 'no dll' }]
        }
      });
      assert.fail('expected throw');
    } catch (err) {
      assert.equal(err.code, ERROR_CODES.BUILDER_DOCTOR_CONTRACT_BROKEN);
      assert.match(err.message, /language: dotnet/);
      assert.match(err.message, /DOTNET_ASSEMBLIES/);
    }
  });

  it('requirePdb treats missing PDB WARN as contract regression', () => {
    assert.throws(
      () =>
        assertDoctorAcceptsBuilderArtifact({
          language: 'dotnet',
          builder: 'dotnet',
          artifact: 'a.zip',
          requirePdb: true,
          doctor: {
            status: 'READY_WITH_WARNINGS',
            checks: [{ id: 'DOTNET_PDB_RECOMMENDED', status: 'WARN' }]
          }
        }),
      (err) => err && err.code === ERROR_CODES.BUILDER_DOCTOR_CONTRACT_BROKEN
    );
  });
});

describe('Gradle init script lifecycle', () => {
  it('creates init script, exposes path during callback, removes afterwards', () => {
    let seen = null;
    withGradleInitScript((initFile) => {
      seen = initFile;
      assert.ok(fs.existsSync(initFile));
      assert.match(path.basename(initFile), /^veracode-gradle-init-\d+\.gradle$/);
      assert.match(fs.readFileSync(initFile, 'utf8'), /options\.debug = true/);
      assert.match(INIT_SCRIPT, /source,lines,vars/);
    });
    assert.ok(seen);
    assert.equal(fs.existsSync(seen), false);
  });

  it('removes init script even when callback throws', () => {
    let seen = null;
    assert.throws(() =>
      withGradleInitScript((initFile) => {
        seen = initFile;
        throw new Error('boom');
      })
    );
    assert.ok(seen);
    assert.equal(fs.existsSync(seen), false);
  });

  it('does not write init script into project directory', () => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), 'gradle-proj-'));
    try {
      fs.writeFileSync(path.join(project, 'build.gradle'), 'plugins { id "java" }\n');
      withGradleInitScript((initFile) => {
        assert.ok(!initFile.startsWith(project));
        assert.equal(fs.existsSync(path.join(project, path.basename(initFile))), false);
      });
    } finally {
      fs.rmSync(project, { recursive: true, force: true });
    }
  });
});
