'use strict';

const { setOutputs, envStr } = require('../utils/common/io');
const { fail, ERROR_CODES, logCaughtError } = require('../utils/errors/errors');
const { registerSecretsFromEnv } = require('../utils/sanitize/sanitize');

const CONFIG_MODES = new Set(['auto', 'refresh', 'readonly', 'disabled']);
const DOCTOR_MODES = new Set(['standard', 'strict']);
const JAVA_MODES = new Set(['auto', 'compiled', 'source']);

function main() {
  // Zero-leak: registrar secrets do ambiente o mais cedo possivel
  registerSecretsFromEnv();

  const configMode = envStr('CONFIG_MODE', 'auto').toLowerCase();
  const doctorMode = envStr('DOCTOR_MODE', 'standard').toLowerCase();
  const javaMode = envStr('JAVA_PACKAGE_MODE', 'compiled').toLowerCase();

  if (!CONFIG_MODES.has(configMode)) {
    fail(ERROR_CODES.INVALID_INPUT, `config_mode invalido: ${configMode}`, {
      howToFix: 'Use auto | refresh | readonly | disabled'
    });
  }
  if (!DOCTOR_MODES.has(doctorMode)) {
    fail(ERROR_CODES.INVALID_INPUT, `doctor_mode invalido: ${doctorMode}`, {
      howToFix: 'Use standard | strict'
    });
  }
  if (!JAVA_MODES.has(javaMode)) {
    fail(ERROR_CODES.INVALID_INPUT, `java_package_mode invalido: ${javaMode}`, {
      howToFix: 'Use auto | compiled | source'
    });
  }

  if (configMode !== 'disabled') {
    const hasApp =
      envStr('CONFIG_GITHUB_APP_ID') &&
      envStr('CONFIG_GITHUB_APP_PRIVATE_KEY') &&
      envStr('CONFIG_GITHUB_APP_INSTALLATION_ID');
    const hasPat = Boolean(envStr('CONFIG_GITHUB_TOKEN'));
    const org = envStr('CONFIG_ORG');
    if (org && !hasApp && !hasPat) {
      fail(ERROR_CODES.CONFIG_AUTH_FAILED, 'config_org informado sem credenciais de GitHub App ou PAT.', {
        stage: 'Validate Inputs',
        requirement: 'config_github_app_* ou config_github_token',
        howToFix: 'Configure o GitHub App (preferencial) ou PAT com contents:read/write no repo de configs.'
      });
    }
  }

  const artifactPath = envStr('ARTIFACT_PATH', '');
  const doctorOnly = Boolean(artifactPath);

  setOutputs({
    config_mode: configMode,
    doctor_mode: doctorMode,
    java_package_mode: javaMode === 'auto' ? 'compiled' : javaMode,
    doctor_only: doctorOnly ? 'true' : 'false',
    validated: 'true'
  });

  console.log(`Inputs validados. config_mode=${configMode} doctor_only=${doctorOnly}`);
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
