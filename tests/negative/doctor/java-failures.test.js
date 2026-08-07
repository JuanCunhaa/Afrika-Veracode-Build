'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { doctorJava } = require('../../../internal/doctor/java/doctor');
const { writeEmptyZip, writeCorruptArchive, zipFromFiles, tmpDir } = require('../helpers/assert');

describe('negative / doctor / java', () => {
  it('JAR/ZIP vazio (sem entradas) → INVALID (ARTIFACT_OPENABLE FAIL)', () => {
    const dir = tmpDir('java-empty-');
    const jar = path.join(dir, 'empty.jar');
    writeEmptyZip(jar);
    const result = doctorJava(jar, { doctorProfile: 'java-compiled' });
    assert.equal(result.status, 'INVALID');
    const openable = result.checks.find((c) => c.id === 'ARTIFACT_OPENABLE');
    assert.ok(openable);
    assert.equal(openable.status, 'FAIL');
  });

  it('JAR sem .class (so META-INF/README) → INVALID (JAVA_BYTECODE_PRESENT FAIL)', () => {
    const { zip } = zipFromFiles({
      'META-INF/MANIFEST.MF': 'Manifest-Version: 1.0\n',
      'README.txt': 'no bytecode'
    });
    // rename conceptually as jar path for doctor
    const jar = zip.replace(/\.zip$/i, '.jar');
    fs.renameSync(zip, jar);
    const result = doctorJava(jar, { doctorProfile: 'java-compiled' });
    assert.equal(result.status, 'INVALID');
    assert.equal(result.checks.find((c) => c.id === 'JAVA_BYTECODE_PRESENT').status, 'FAIL');
  });

  it('bytecode presente sem debug verificado → READY_WITH_WARNINGS (nao INVALID)', () => {
    // Veracode analisa Java com ou sem debug; debug e recomendacao (warning), nao erro duro.
    const { zip } = zipFromFiles({
      'com/example/App.class': Buffer.from([0xca, 0xfe, 0xba, 0xbe, 0x00, 0x00, 0x00, 0x34])
    });
    const result = doctorJava(zip, { doctorProfile: 'java-compiled' });
    assert.notEqual(result.status, 'INVALID');
    assert.equal(result.status, 'READY_WITH_WARNINGS');
    assert.equal(result.checks.find((c) => c.id === 'JAVA_BYTECODE_PRESENT').status, 'PASS');
    assert.equal(result.checks.find((c) => c.id === 'JAVA_DEBUG_INFORMATION').status, 'WARN');
  });

  it('archive corrompido → INVALID (ARTIFACT_OPENABLE ou JAVA_ARCHIVE FAIL)', () => {
    const dir = tmpDir('java-corrupt-');
    const jar = path.join(dir, 'corrupt.jar');
    writeCorruptArchive(jar);
    const result = doctorJava(jar, { doctorProfile: 'java-compiled' });
    assert.equal(result.status, 'INVALID');
    const failed = result.checks.filter((c) => c.status === 'FAIL');
    assert.ok(failed.some((c) => c.id === 'ARTIFACT_OPENABLE' || c.id === 'JAVA_ARCHIVE'));
  });

  it('WAR sem WEB-INF → READY_WITH_WARNINGS (JAVA_WAR_STRUCTURE WARN, nao INVALID)', () => {
    // Catalogo Veracode-requirements: JAVA_WAR_STRUCTURE severity=warning
    const dir = tmpDir('java-war-');
    const warContent = path.join(dir, 'war-root');
    fs.mkdirSync(warContent);
    fs.writeFileSync(path.join(warContent, 'index.html'), '<html/>');
    fs.writeFileSync(path.join(warContent, 'App.class'), Buffer.from([0xca, 0xfe, 0xba, 0xbe]));
    const warPathZip = path.join(dir, 'app.zip');
    const warPath = path.join(dir, 'app.war');
    const { zipDirectoryContents } = require('../../../internal/utils/artifact/artifact');
    zipDirectoryContents(warContent, warPathZip);
    fs.renameSync(warPathZip, warPath);
    const result = doctorJava(warPath, { doctorProfile: 'java-compiled' });
    assert.notEqual(result.status, 'INVALID');
    const war = result.checks.find((c) => c.id === 'JAVA_WAR_STRUCTURE');
    assert.ok(war);
    assert.equal(war.status, 'WARN');
    assert.equal(result.status, 'READY_WITH_WARNINGS');
  });
});
