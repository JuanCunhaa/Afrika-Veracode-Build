'use strict';

const fs = require('fs');
const path = require('path');
const { scrubSecretsFromObject, normalizeRequiredEnvVars } = require('../sanitize/sanitize');

const SUPPORTED_SCHEMA_VERSION = 1;

/**
 * Validacao leve (sem dependencia AJV) dos schemas internos.
 */

function assert(condition, message) {
  if (!condition) {
    const err = new Error(message);
    err.code = 'SCHEMA_INVALID';
    throw err;
  }
}

function validateDiscoveryResult(obj) {
  assert(obj && typeof obj === 'object', 'DiscoveryResult invalido');
  assert(obj.schemaVersion === 1, 'DiscoveryResult.schemaVersion deve ser 1');
  assert(typeof obj.language === 'string' && obj.language, 'DiscoveryResult.language obrigatorio');
  assert(['HIGH', 'MEDIUM', 'LOW'].includes(obj.confidence), 'DiscoveryResult.confidence invalido');
  if (obj.requiredEnvironmentVariables) {
    obj.requiredEnvironmentVariables = normalizeRequiredEnvVars(obj.requiredEnvironmentVariables);
  }
  return obj;
}

function validateBuildPlan(obj) {
  assert(obj && typeof obj === 'object', 'BuildPlan invalido');
  assert(obj.schemaVersion === 1, 'BuildPlan.schemaVersion deve ser 1');
  assert(typeof obj.language === 'string' && obj.language, 'BuildPlan.language obrigatorio');
  assert(typeof obj.strategy === 'string' && obj.strategy, 'BuildPlan.strategy obrigatorio');
  assert(typeof obj.projectPath === 'string', 'BuildPlan.projectPath obrigatorio');
  if (obj.requiredEnvironmentVariables) {
    obj.requiredEnvironmentVariables = normalizeRequiredEnvVars(obj.requiredEnvironmentVariables);
  }
  return obj;
}

function validateBuildConfig(obj) {
  assert(obj && typeof obj === 'object', 'BuildConfig invalido');
  assert(Number.isInteger(obj.schemaVersion) && obj.schemaVersion >= 1, 'BuildConfig.schemaVersion invalido');
  assert(typeof obj.repository === 'string' && obj.repository, 'BuildConfig.repository obrigatorio');
  assert(obj.discovery && typeof obj.discovery === 'object', 'BuildConfig.discovery obrigatorio');
  assert(obj.builder && typeof obj.builder === 'object', 'BuildConfig.builder obrigatorio');
  assert(obj.fingerprint && typeof obj.fingerprint.value === 'string', 'BuildConfig.fingerprint obrigatorio');

  if (obj.schemaVersion > SUPPORTED_SCHEMA_VERSION) {
    const err = new Error(
      `BuildConfig schemaVersion=${obj.schemaVersion} nao suportado (max=${SUPPORTED_SCHEMA_VERSION}). Marque como stale e rediscubra.`
    );
    err.code = 'CONFIG_STALE';
    throw err;
  }

  if (obj.dependencies?.requiredEnvironmentVariables) {
    obj.dependencies.requiredEnvironmentVariables = normalizeRequiredEnvVars(
      obj.dependencies.requiredEnvironmentVariables
    );
  }

  return scrubSecretsFromObject(obj);
}

function validateDoctorResult(obj) {
  assert(obj && typeof obj === 'object', 'DoctorResult invalido');
  assert(['READY', 'READY_WITH_WARNINGS', 'INVALID', 'UNKNOWN'].includes(obj.status), 'DoctorResult.status invalido');
  assert(Array.isArray(obj.checks), 'DoctorResult.checks obrigatorio');
  return obj;
}

/**
 * Migra configs futuras; v1 e identidade.
 * @param {object} config
 * @returns {object}
 */
function migrateBuildConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('BuildConfig ausente');
  }
  if (config.schemaVersion === 1) {
    return validateBuildConfig(config);
  }
  if (config.schemaVersion > SUPPORTED_SCHEMA_VERSION) {
    const err = new Error('schemaVersion futuro nao migravel neste MVP');
    err.code = 'CONFIG_STALE';
    throw err;
  }
  return validateBuildConfig(config);
}

function loadSchemaFile(name) {
  const p = path.join(__dirname, '..', '..', '..', 'schemas', name);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

module.exports = {
  SUPPORTED_SCHEMA_VERSION,
  validateDiscoveryResult,
  validateBuildPlan,
  validateBuildConfig,
  validateDoctorResult,
  migrateBuildConfig,
  loadSchemaFile
};
