'use strict';

const fs = require('fs');
const path = require('path');
const maven = require('./detectors/maven');
const gradle = require('./detectors/gradle');
const javascript = require('./detectors/javascript');
const dotnet = require('./detectors/dotnet');
const { fail, ERROR_CODES } = require('../utils/errors/errors');
const { validateDiscoveryResult } = require('../utils/schemas/validate');
const { isAuto } = require('../utils/common/io');

/**
 * Discovery orchestrator.
 * @param {string} sourceRoot
 * @param {{ projectPath?: string, language?: string, buildSystem?: string }} [overrides]
 */
function discover(sourceRoot, overrides = {}) {
  const root = path.resolve(sourceRoot);
  if (!fs.existsSync(root)) {
    fail(ERROR_CODES.PROJECT_NOT_FOUND, `Diretorio source nao encontrado: ${root}`, {
      stage: 'Discovery'
    });
  }

  const projectPathInput = overrides.projectPath || '.';
  const scanRoot =
    projectPathInput && projectPathInput !== '.' && projectPathInput !== './'
      ? path.resolve(root, projectPathInput)
      : root;

  const languageHint = String(overrides.language || 'auto').toLowerCase();
  const buildSystemHint = String(overrides.buildSystem || 'auto').toLowerCase();

  /** @type {object[]} */
  const hits = [];

  const tryDetect = (name, fn) => {
    try {
      const result = fn(scanRoot, { projectPath: projectPathInput });
      if (result) hits.push({ name, result });
    } catch (err) {
      if (err.code && ERROR_CODES[err.code]) throw err;
      console.log(`::warning::Detector ${name} falhou: ${err.message}`);
    }
  };

  if (isAuto(languageHint) || languageHint === 'java') {
    if (isAuto(buildSystemHint) || buildSystemHint === 'maven') tryDetect('maven', maven.detect);
    if (isAuto(buildSystemHint) || buildSystemHint === 'gradle') tryDetect('gradle', gradle.detect);
  }
  if (isAuto(languageHint) || languageHint === 'javascript' || languageHint === 'typescript') {
    tryDetect('javascript', javascript.detect);
  }
  if (isAuto(languageHint) || languageHint === 'dotnet' || languageHint === 'csharp') {
    tryDetect('dotnet', (r, o) => dotnet.detect(r, o));
  }

  if (hits.length === 0) {
    fail(ERROR_CODES.UNSUPPORTED_LANGUAGE, 'Nenhuma tecnologia suportada pelo MVP foi detectada.', {
      stage: 'Discovery',
      detected: `language=${languageHint}, path=${scanRoot}`,
      requirement: 'Java Maven/Gradle, JavaScript/TypeScript ou .NET',
      howToFix: 'Informe language/build_system/project_path ou adicione manifests reconhecidos.'
    });
  }

  // Prefer explicit build system
  let chosen = hits[0];
  if (!isAuto(buildSystemHint)) {
    const match = hits.find((h) => String(h.result.buildSystem).toLowerCase() === buildSystemHint);
    if (match) chosen = match;
  } else if (!isAuto(languageHint)) {
    const match = hits.find((h) => String(h.result.language).toLowerCase() === languageHint);
    if (match) chosen = match;
  } else {
    // Priority: maven/gradle over js over conflicting; if both java systems, prefer wrapper presence order already
    const order = ['maven', 'gradle', 'dotnet', 'javascript'];
    hits.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
    chosen = hits[0];
  }

  let result = { ...chosen.result };

  if (result.ambiguous) {
    const candidates = (result.candidates || []).map((c) => `- ${c}`).join('\n');
    fail(ERROR_CODES.AMBIGUOUS_PROJECT, result.message || 'Projeto ambiguo detectado.', {
      stage: 'Discovery',
      detected: candidates,
      requirement: 'project_path unico',
      howToFix: `Informe project_path com um dos candidatos:\n${candidates}`
    });
  }

  if (result.notImplemented) {
    fail(ERROR_CODES.NOT_IMPLEMENTED, `${result.notImplementedTechnology} ainda nao e suportado no MVP.`, {
      stage: 'Discovery',
      detected: result.notImplementedTechnology,
      howToFix: 'Aguarde Fase 2 ou prepare o artifact manualmente e use artifact_path + Doctor.'
    });
  }

  // Apply path relative to source root for reporting
  if (!result.projectPath || result.projectPath === '.') {
    result.projectPath = projectPathInput || '.';
  }

  if (overrides.framework && !isAuto(overrides.framework)) {
    result.framework = overrides.framework;
  }
  if (overrides.runtimeVersion && !isAuto(overrides.runtimeVersion)) {
    result.runtimeVersion = overrides.runtimeVersion;
  }
  if (overrides.packageManager && !isAuto(overrides.packageManager)) {
    result.packageManager = overrides.packageManager;
  }

  result = validateDiscoveryResult(result);
  return result;
}

module.exports = { discover };
