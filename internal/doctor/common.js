'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { spawnSync } = require('child_process');

/**
 * Helpers genericos do Doctor.
 */

function listZipEntries(zipPath) {
  if (process.platform === 'win32') {
    const ps = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::OpenRead('${zipPath.replace(/'/g, "''")}').Entries | ForEach-Object { $_.FullName }
`;
    const out = execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { encoding: 'utf8' });
    return out
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const out = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' });
  return out
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function extractFileFromZip(zipPath, entryName, destFile) {
  if (process.platform === 'win32') {
    const ps = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead('${zipPath.replace(/'/g, "''")}')
$e = $zip.Entries | Where-Object { $_.FullName -eq '${entryName.replace(/'/g, "''")}' } | Select-Object -First 1
if ($null -eq $e) { throw 'missing' }
[IO.Compression.ZipFileExtensions]::ExtractToFile($e, '${destFile.replace(/'/g, "''")}', $true)
$zip.Dispose()
`;
    execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { encoding: 'utf8' });
    return;
  }
  const dir = path.dirname(destFile);
  fs.mkdirSync(dir, { recursive: true });
  execFileSync('unzip', ['-p', zipPath, entryName], {
    encoding: 'buffer',
    maxBuffer: 50 * 1024 * 1024
  });
  const buf = spawnSync('unzip', ['-p', zipPath, entryName], { encoding: 'buffer' }).stdout;
  fs.writeFileSync(destFile, buf);
}

function finalizeStatus(checks) {
  if (checks.some((c) => c.status === 'FAIL')) return 'INVALID';
  if (checks.some((c) => c.status === 'WARN')) return 'READY_WITH_WARNINGS';
  if (checks.length === 0) return 'UNKNOWN';
  return 'READY';
}

function genericChecks(artifactPath) {
  const checks = [];
  if (!fs.existsSync(artifactPath)) {
    checks.push({ id: 'ARTIFACT_EXISTS', status: 'FAIL', message: 'Artifact nao encontrado.' });
    return checks;
  }
  const st = fs.statSync(artifactPath);
  if (st.size === 0) {
    checks.push({ id: 'ARTIFACT_EXISTS', status: 'FAIL', message: 'Artifact vazio.' });
    return checks;
  }
  checks.push({ id: 'ARTIFACT_EXISTS', status: 'PASS' });

  const lower = artifactPath.toLowerCase();
  if (lower.endsWith('.rar')) {
    checks.push({
      id: 'ARTIFACT_FORMAT',
      status: 'FAIL',
      message: 'RAR nao e formato suportado tipico para upload Veracode neste fluxo.'
    });
  } else {
    checks.push({ id: 'ARTIFACT_FORMAT', status: 'PASS' });
  }

  if (lower.endsWith('.zip') || lower.endsWith('.jar') || lower.endsWith('.war') || lower.endsWith('.ear')) {
    try {
      const entries = listZipEntries(artifactPath);
      if (entries.length === 0) {
        checks.push({ id: 'ARTIFACT_OPENABLE', status: 'FAIL', message: 'Archive sem entradas.' });
      } else {
        checks.push({ id: 'ARTIFACT_OPENABLE', status: 'PASS', message: `${entries.length} entradas` });
      }
    } catch (err) {
      checks.push({
        id: 'ARTIFACT_OPENABLE',
        status: 'FAIL',
        message: `Nao foi possivel abrir o archive: ${err.message}`
      });
    }
  }

  return checks;
}

module.exports = {
  listZipEntries,
  extractFileFromZip,
  finalizeStatus,
  genericChecks
};
