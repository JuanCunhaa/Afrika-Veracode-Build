'use strict';

/**
 * Codigos de erro padronizados da Afrika-Veracode-Build.
 */

const { sanitizeText, sanitizeError } = require('../sanitize/sanitize');

const ERROR_CODES = Object.freeze({
  UNSUPPORTED_LANGUAGE: 'UNSUPPORTED_LANGUAGE',
  UNSUPPORTED_VERSION: 'UNSUPPORTED_VERSION',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',

  AMBIGUOUS_PROJECT: 'AMBIGUOUS_PROJECT',
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',

  TOOLCHAIN_NOT_FOUND: 'TOOLCHAIN_NOT_FOUND',
  TOOLCHAIN_SETUP_FAILED: 'TOOLCHAIN_SETUP_FAILED',
  RUNNER_OS_INCOMPATIBLE: 'RUNNER_OS_INCOMPATIBLE',

  DEPENDENCY_RESTORE_FAILED: 'DEPENDENCY_RESTORE_FAILED',
  DEPENDENCY_AUTH_REQUIRED: 'DEPENDENCY_AUTH_REQUIRED',
  DEPENDENCY_REGISTRY_UNAVAILABLE: 'DEPENDENCY_REGISTRY_UNAVAILABLE',

  BUILD_FAILED: 'BUILD_FAILED',
  PACKAGING_FAILED: 'PACKAGING_FAILED',

  ARTIFACT_NOT_FOUND: 'ARTIFACT_NOT_FOUND',
  ARTIFACT_EMPTY: 'ARTIFACT_EMPTY',
  ARTIFACT_INVALID: 'ARTIFACT_INVALID',
  ARTIFACT_MISSING_DEBUG_INFO: 'ARTIFACT_MISSING_DEBUG_INFO',
  ARTIFACT_MISSING_DEPENDENCY: 'ARTIFACT_MISSING_DEPENDENCY',

  CONFIG_AUTH_FAILED: 'CONFIG_AUTH_FAILED',
  CONFIG_REPO_NOT_FOUND: 'CONFIG_REPO_NOT_FOUND',
  CONFIG_READ_FAILED: 'CONFIG_READ_FAILED',
  CONFIG_WRITE_FAILED: 'CONFIG_WRITE_FAILED',
  CONFIG_STALE: 'CONFIG_STALE',

  DOCTOR_FAILED: 'DOCTOR_FAILED',
  BUILDER_DOCTOR_CONTRACT_BROKEN: 'BUILDER_DOCTOR_CONTRACT_BROKEN',
  SECRET_LEAK_DETECTED: 'SECRET_LEAK_DETECTED',
  INVALID_INPUT: 'INVALID_INPUT'
});

/**
 * Formata e emite erro estruturado para GitHub Actions (sempre sanitizado).
 * @param {string} code
 * @param {string} message
 * @param {{ detected?: string, stage?: string, requirement?: string, why?: string, howToFix?: string }} [details]
 */
function fail(code, message, details = {}) {
  const safeMessage = sanitizeText(message);
  const lines = [code, '', safeMessage];

  if (details.detected) {
    lines.push('', `Detectado: ${sanitizeText(details.detected)}`);
  }
  if (details.stage) {
    lines.push(`Etapa: ${sanitizeText(details.stage)}`);
  }
  if (details.requirement) {
    lines.push(`Requisito: ${sanitizeText(details.requirement)}`);
  }
  if (details.why) {
    lines.push(`Por que e necessario: ${sanitizeText(details.why)}`);
  }
  if (details.howToFix) {
    lines.push('', 'Como corrigir:', sanitizeText(details.howToFix));
  }

  const text = lines.join('\n');
  console.error(`::error title=${code}::${safeMessage.replace(/\n/g, '%0A')}`);
  console.error(text);
  const err = new Error(text);
  err.code = code;
  throw err;
}

/**
 * Emite erro de catch ja sanitizado (stack incluido).
 * @param {unknown} err
 */
function logCaughtError(err) {
  const clean = sanitizeError(err);
  console.error(`::error::${clean.message}`);
  if (clean.stack) {
    console.error(sanitizeText(clean.stack));
  }
}

/**
 * Classifica saida de restore/.NET/NuGet em codigo de autenticacao quando possivel.
 * @param {string} output
 * @returns {string|null}
 */
function classifyDependencyError(output) {
  const text = String(output || '');
  if (/NU1301|401|403|Authentication failed|Unauthorized|Unable to load service index|401 Unauthorized/i.test(text)) {
    return ERROR_CODES.DEPENDENCY_AUTH_REQUIRED;
  }
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|service unavailable|Could not resolve host|registry.*unavailable/i.test(text)) {
    return ERROR_CODES.DEPENDENCY_REGISTRY_UNAVAILABLE;
  }
  return null;
}

module.exports = {
  ERROR_CODES,
  fail,
  logCaughtError,
  classifyDependencyError
};
