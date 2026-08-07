'use strict';

const fs = require('fs');
const path = require('path');
const { zipDirectoryContents } = require('../../utils/artifact/artifact');
const { setOutputs, readJson, envStr, ensureDir, timingNow, timingMs } = require('../../utils/common/io');
const { fail, ERROR_CODES, logCaughtError } = require('../../utils/errors/errors');
const { registerSecretsFromEnv } = require('../../utils/sanitize/sanitize');

/**
 * JavaScript/TypeScript SOURCE_PACKAGE builder.
 * Nao executa production build / minify / bundle.
 */
function main() {
  registerSecretsFromEnv();
  const start = timingNow();
  const plan = readJson(envStr('BUILD_PLAN_PATH', '.veracode-build/build-plan.json'));
  const source = path.resolve(envStr('SOURCE', '.'));
  const projectPath = path.resolve(source, plan.projectPath || '.');
  const outputDir = path.resolve(envStr('OUTPUT_DIR', '.veracode-build'));
  const artifactName = envStr('ARTIFACT_NAME', 'analysisPack.zip');

  let extraExcludes = [];
  try {
    const raw = envStr('JAVASCRIPT_EXCLUDE_PATTERNS', '');
    if (raw) {
      extraExcludes = raw
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
  } catch {
    extraExcludes = [];
  }

  const excludeNames = [
    'node_modules',
    '.git',
    'coverage',
    '.veracode-build',
    'dist',
    'build',
    '.next',
    'out',
    '.nuxt',
    '.output',
    ...extraExcludes
  ];

  // Never run npm run build for Veracode packaging
  if (/npm\s+run\s+build|webpack|vite\s+build|next\s+build|rollup|uglify|terser/i.test(envStr('BUILD_COMMAND', ''))) {
    fail(
      ERROR_CODES.BUILD_FAILED,
      'build_command de producao/minificacao nao e permitido para packaging JS/TS Veracode.',
      {
        stage: 'Builder',
        requirement: 'SOURCE_PACKAGE com source legivel',
        howToFix: 'Remova build_command de bundle/minify. Envie o source original.'
      }
    );
  }

  ensureDir(outputDir);
  const outZip = path.join(outputDir, artifactName);

  if (!fs.existsSync(path.join(projectPath, 'package.json'))) {
    fail(ERROR_CODES.PROJECT_NOT_FOUND, 'package.json nao encontrado para source package JS/TS.', {
      stage: 'Builder'
    });
  }

  try {
    zipDirectoryContents(projectPath, outZip, { excludeNames });
  } catch (err) {
    fail(ERROR_CODES.PACKAGING_FAILED, err.message || String(err), { stage: 'Packaging' });
  }

  const elapsed = timingMs(start) / 1000;
  setOutputs({
    restore_status: 'skipped',
    build_status: 'success',
    artifact_path: outZip,
    artifact_name: artifactName,
    artifact_status: 'ready',
    builder_seconds: elapsed.toFixed(3)
  });
  console.log(`JS/TS source package gerado em ${elapsed.toFixed(1)}s (sem production build)`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    logCaughtError(err);
    process.exit(1);
  }
}

module.exports = { main };
