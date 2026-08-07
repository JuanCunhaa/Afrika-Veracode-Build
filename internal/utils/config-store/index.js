'use strict';

const path = require('path');
const fs = require('fs');
const { computeFingerprint } = require('../fingerprint/fingerprint');
const { buildConfigDocument } = require('./github-config');
const { setOutputs, readJson, writeJson, envStr, ensureDir } = require('../common/io');

/**
 * Decide se config remoto ainda e valido comparando fingerprint.
 */
function main() {
  const command = process.argv[2] || 'evaluate';
  const source = path.resolve(envStr('SOURCE', '.'));
  const configFile = envStr('CONFIG_FILE', '');
  const planFile = envStr('BUILD_PLAN_PATH', '.veracode-build/build-plan.json');
  const outputDir = path.resolve(envStr('OUTPUT_DIR', '.veracode-build'));
  const repository = envStr('SCAN_REPOSITORY', envStr('GITHUB_REPOSITORY', ''));

  ensureDir(outputDir);

  if (command === 'evaluate') {
    if (!configFile || !fs.existsSync(configFile)) {
      setOutputs({
        config_usable: 'false',
        config_status: 'missing',
        fingerprint: ''
      });
      return;
    }
    const config = readJson(configFile);
    const meta = {
      language: config.discovery?.language,
      buildSystem: config.discovery?.buildSystem
    };
    const projectPath = path.resolve(source, config.projectPath || '.');
    const fp = computeFingerprint(projectPath, meta);
    const usable = config.fingerprint?.value && config.fingerprint.value === fp.value;
    setOutputs({
      config_usable: usable ? 'true' : 'false',
      config_status: usable ? 'reused' : 'stale',
      fingerprint: fp.value
    });
    writeJson(path.join(outputDir, 'fingerprint.json'), fp);
    console.log(
      usable ? 'Fingerprint valido — Discovery pode ser pulado.' : 'Fingerprint stale — rediscovery necessario.'
    );
    return;
  }

  if (command === 'generate') {
    const plan = readJson(planFile);
    const projectPath = path.resolve(source, plan.projectPath || '.');
    const fp = computeFingerprint(projectPath, {
      language: plan.language,
      buildSystem: plan.buildSystem
    });
    const doc = buildConfigDocument({
      repository,
      plan,
      fingerprint: fp,
      discovery: plan
    });
    const out = path.join(outputDir, 'build-config.json');
    writeJson(out, doc);
    setOutputs({
      config_file: out,
      fingerprint: fp.value
    });
    console.log(`build-config.json gerado em ${out}`);
    return;
  }

  throw new Error(`Comando desconhecido: ${command}`);
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
