'use strict';

/**
 * Helpers do contrato Builder → Doctor.
 * if Builder.status === success && strategy suportada → Doctor MUST NOT return INVALID
 */

const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { ERROR_CODES } = require('../../../../internal/utils/errors/errors');

function listZip(zipPath) {
  if (process.platform === 'win32') {
    const ps = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::OpenRead('${zipPath.replace(/'/g, "''")}').Entries | ForEach-Object { $_.FullName }
`;
    return execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { encoding: 'utf8' })
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' })
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * @param {{ language: string, runtime?: string, builder: string, artifact: string, doctor: object }} ctx
 */
function failContract(ctx) {
  const failed = (ctx.doctor.checks || []).filter((c) => c.status === 'FAIL');
  const lines = [
    ERROR_CODES.BUILDER_DOCTOR_CONTRACT_BROKEN,
    '',
    'Builder produziu artifact com sucesso, mas o Doctor retornou INVALID.',
    '',
    `language: ${ctx.language}`,
    `runtime: ${ctx.runtime || 'n/a'}`,
    `builder: ${ctx.builder}`,
    `artifact: ${ctx.artifact}`,
    `doctor_status: ${ctx.doctor.status}`,
    '',
    'failed doctor rules:'
  ];
  for (const c of failed) {
    lines.push(` - ${c.id}${c.message ? `: ${c.message}` : ''}`);
  }
  if (failed.length === 0) {
    lines.push(' - (nenhuma regra FAIL listada; status INVALID inesperado)');
  }
  const text = lines.join('\n');
  console.error(`::error title=${ERROR_CODES.BUILDER_DOCTOR_CONTRACT_BROKEN}::${text.replace(/\n/g, '%0A')}`);
  console.error(text);
  const err = new Error(text);
  err.code = ERROR_CODES.BUILDER_DOCTOR_CONTRACT_BROKEN;
  throw err;
}

/**
 * Warnings permitidos por perfil (nao mascaram regressao de Builder).
 * Qualquer FAIL → contrato quebrado.
 */
const ALLOWED_WARN_IDS = new Set([
  'JAVA_DEBUG_INFORMATION',
  'JAVA_OBFUSCATION',
  'JAVA_WAR_STRUCTURE',
  'JS_LOCKFILE_PRESENT',
  'JS_SOURCEMAP_CONTENT',
  'JS_PACKAGE_JSON',
  'JS_NODE_MODULES_EXCLUDED',
  'JS_SOURCE_READABLE',
  'TS_SOURCE_PRESERVED',
  'DOTNET_PDB_RECOMMENDED',
  'DOTNET_DEPS_JSON',
  'DOTNET_NO_TEST_ASSEMBLIES',
  'ASPNET_ROSLYN',
  'ARTIFACT_FORMAT'
]);

function assertDoctorAcceptsBuilderArtifact(ctx) {
  const status = ctx.doctor.status;
  if (status === 'INVALID') {
    failContract(ctx);
  }
  if (status !== 'READY' && status !== 'READY_WITH_WARNINGS') {
    failContract({ ...ctx, doctor: { ...ctx.doctor, status: status || 'UNKNOWN' } });
  }

  // Warnings must be known/intentional; unexplained WARN IDs still ok if documented in ALLOWED
  const warns = (ctx.doctor.checks || []).filter((c) => c.status === 'WARN');
  for (const w of warns) {
    if (!ALLOWED_WARN_IDS.has(w.id)) {
      console.log(`::warning::Doctor WARN nao catalogado no contrato: ${w.id}`);
    }
  }

  // Regressao: se Builder .NET Debug deveria ter PDB e Doctor WARN PDB — flag como regressao opcional
  if (ctx.requirePdb) {
    const pdb = (ctx.doctor.checks || []).find((c) => c.id === 'DOTNET_PDB_RECOMMENDED');
    if (pdb && pdb.status === 'WARN') {
      const err = new Error(
        `${ERROR_CODES.BUILDER_DOCTOR_CONTRACT_BROKEN}\nBuilder deveria produzir PDB (Debug) mas DOTNET_PDB_RECOMMENDED=WARN`
      );
      err.code = ERROR_CODES.BUILDER_DOCTOR_CONTRACT_BROKEN;
      throw err;
    }
  }
}

function hasEntry(entries, needle) {
  const n = String(needle).toLowerCase();
  return entries.some((e) => e.toLowerCase().includes(n) || new RegExp(n.replace(/\./g, '\\.')).test(e));
}

/**
 * Tenta javap -verbose em um .class extraido (best-effort).
 * @returns {{ ok: boolean, hasLineNumberTable?: boolean, hasSourceFile?: boolean, reason?: string }}
 */
function probeJavaDebug(zipPath, classEntry) {
  if (!classEntry) return { ok: false, reason: 'no-class-entry' };
  const javap = spawnSync('javap', ['-version'], { encoding: 'utf8' });
  if (javap.status !== 0) return { ok: false, reason: 'javap-unavailable' };

  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'javap-'));
  const classFile = path.join(tmp, path.basename(classEntry));
  try {
    if (process.platform === 'win32') {
      const ps = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead('${zipPath.replace(/'/g, "''")}')
$e = $zip.Entries | Where-Object { $_.FullName -eq '${classEntry.replace(/'/g, "''")}' } | Select-Object -First 1
if ($null -eq $e) { throw 'missing' }
[IO.Compression.ZipFileExtensions]::ExtractToFile($e, '${classFile.replace(/'/g, "''")}', $true)
$zip.Dispose()
`;
      execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { encoding: 'utf8' });
    } else {
      execFileSync('unzip', ['-p', zipPath, classEntry], { encoding: 'buffer', maxBuffer: 20 * 1024 * 1024 });
      const buf = spawnSync('unzip', ['-p', zipPath, classEntry], { encoding: 'buffer' }).stdout;
      fs.writeFileSync(classFile, buf);
    }
    const out = spawnSync('javap', ['-verbose', '-classpath', tmp, path.basename(classEntry, '.class')], {
      encoding: 'utf8'
    });
    const text = `${out.stdout || ''}\n${out.stderr || ''}`;
    return {
      ok: out.status === 0,
      hasLineNumberTable: /LineNumberTable/i.test(text),
      hasSourceFile: /SourceFile:/i.test(text),
      hasLocalVariableTable: /LocalVariableTable/i.test(text)
    };
  } catch (err) {
    return { ok: false, reason: err.message };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

module.exports = {
  listZip,
  failContract,
  assertDoctorAcceptsBuilderArtifact,
  hasEntry,
  probeJavaDebug,
  ALLOWED_WARN_IDS,
  ERROR_CODES
};
