'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Helpers compartilhados para Actions Node.
 */

function setOutput(name, value) {
  const out = process.env.GITHUB_OUTPUT;
  const v = value === undefined || value === null ? '' : String(value);
  if (out) {
    // delimiter para valores com newline
    if (v.includes('\n')) {
      const delim = `EOF_${name}_${Date.now()}`;
      fs.appendFileSync(out, `${name}<<${delim}\n${v}\n${delim}\n`);
    } else {
      fs.appendFileSync(out, `${name}=${v}\n`);
    }
  }
}

function setOutputs(map) {
  for (const [k, v] of Object.entries(map)) {
    setOutput(k, v);
  }
}

function appendStepSummary(markdown) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (file) {
    fs.appendFileSync(file, `${markdown}\n`);
  }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function envBool(name, defaultValue = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === '') {
    return defaultValue;
  }
  return String(raw).toLowerCase() === 'true';
}

function envStr(name, defaultValue = '') {
  const raw = process.env[name];
  if (raw === undefined || raw === null) return defaultValue;
  return String(raw);
}

function timingNow() {
  return process.hrtime.bigint();
}

function timingMs(start) {
  const end = process.hrtime.bigint();
  return Number(end - start) / 1e6;
}

function isAuto(value) {
  const v = String(value || '')
    .trim()
    .toLowerCase();
  return v === '' || v === 'auto';
}

module.exports = {
  setOutput,
  setOutputs,
  appendStepSummary,
  ensureDir,
  writeJson,
  readJson,
  envBool,
  envStr,
  timingNow,
  timingMs,
  isAuto
};
