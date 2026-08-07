'use strict';

const { setOutputs, envStr } = require('../common/io');
const { printAsciiSummary, writeStepSummary } = require('./summary');

function main() {
  const artifactPath = envStr('ARTIFACT_PATH_INPUT', '') || envStr('BUILDER_ARTIFACT', '');
  const artifactName = envStr('ARTIFACT_NAME', 'analysisPack.zip');
  const doctorStatus = envStr('DOCTOR_STATUS', 'UNKNOWN');
  const configMode = envStr('CONFIG_MODE', 'auto');
  const configUsable = envStr('CONFIG_USABLE', 'false') === 'true';
  const configSaved = envStr('CONFIG_SAVED', '') === 'true';

  let configStatus = 'skipped';
  let configSource = 'none';
  if (configMode === 'disabled') {
    configStatus = 'disabled';
  } else if (configSaved) {
    configStatus = configUsable ? 'updated' : 'created';
    configSource = 'remote';
  } else if (configUsable) {
    configStatus = 'reused';
    configSource = 'remote';
  } else if (envStr('CONFIG_PATH')) {
    configSource = 'remote';
    configStatus = 'stale';
  }

  const summary = {
    language: envStr('LANGUAGE', '-'),
    framework: envStr('FRAMEWORK', '-'),
    runtime: envStr('RUNTIME_VERSION', '-'),
    buildSystem: envStr('BUILD_SYSTEM', '-'),
    strategy: envStr('PACKAGING_STRATEGY', '-'),
    artifactName,
    artifactPath,
    doctorStatus,
    configStatus: configStatus.toUpperCase(),
    confidence: envStr('CONFIDENCE', '-'),
    warnings: envStr('DOCTOR_WARNINGS', '')
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean),
    timings: {
      Discovery: Number(envStr('DISCOVERY_SECONDS', '0')) || 0,
      Build: Number(envStr('BUILDER_SECONDS', '0')) || 0,
      Doctor: Number(envStr('DOCTOR_SECONDS', '0')) || 0
    }
  };

  printAsciiSummary(summary);
  writeStepSummary(summary);

  setOutputs({
    language: summary.language,
    framework: summary.framework,
    runtime_version: summary.runtime,
    build_system: summary.buildSystem,
    package_manager: envStr('PACKAGE_MANAGER', ''),
    packaging_strategy: summary.strategy,
    project_path: envStr('PROJECT_PATH', '.'),
    restore_status: envStr('RESTORE_STATUS', 'skipped'),
    build_status: envStr('BUILD_STATUS', 'skipped'),
    artifact_path: artifactPath,
    artifact_name: artifactName,
    artifact_status: artifactPath ? 'ready' : 'missing',
    config_source: configSource,
    config_status: configStatus,
    config_path: envStr('CONFIG_PATH', ''),
    required_env_vars: envStr('REQUIRED_ENV', ''),
    discovery_confidence: summary.confidence
  });
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(`::error::${err.message || err}`);
    process.exit(1);
  }
}

module.exports = { main };
