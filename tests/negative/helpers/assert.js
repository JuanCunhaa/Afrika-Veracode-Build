'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { zipFromFiles } = require('../../unit/helpers/zip');

/**
 * Executa fn e exige que fail() lance o error code esperado.
 * @param {() => unknown} fn
 * @param {string} expectedCode
 */
function assertFailsWith(fn, expectedCode) {
  let caught;
  try {
    fn();
  } catch (err) {
    caught = err;
  }
  assert.ok(caught, `esperava falha com ${expectedCode}`);
  assert.equal(caught.code, expectedCode, `Expected:\n${expectedCode}\n\nReceived:\n${caught.code || caught.message}`);
}

/**
 * ZIP minimo vazio (EOCD only) — archive "valido" sem entradas.
 * @param {string} filePath
 */
function writeEmptyZip(filePath) {
  // End of central directory record with 0 entries
  const eocd = Buffer.from([
    0x50, 0x4b, 0x05, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00
  ]);
  fs.writeFileSync(filePath, eocd);
}

/**
 * Bytes aleatorios com extensao de archive (corrompido).
 * @param {string} filePath
 */
function writeCorruptArchive(filePath) {
  fs.writeFileSync(filePath, Buffer.from('NOT_A_ZIP_OR_JAR_CONTENT_XXXX'));
}

function tmpDir(prefix = 'avb-neg-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

const negativeFixtures = path.join(__dirname, '..', '..', 'fixtures', 'negative');

module.exports = {
  assertFailsWith,
  writeEmptyZip,
  writeCorruptArchive,
  tmpDir,
  zipFromFiles,
  negativeFixtures
};
