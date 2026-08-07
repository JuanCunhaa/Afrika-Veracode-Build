'use strict';

const path = require('path');
const { discover } = require('./discovery');
const { toBuildPlan, mergePlanFromConfig } = require('./build-plan');
const {
  setOutputs,
  writeJson,
  ensureDir,
  envStr,
  envBool,
  timingNow,
  timingMs,
  readJson
} = require('../utils/common/io');

function main() {
  const start = timingNow();
  const source = path.resolve(envStr('SOURCE', '.'));
  const projectPath = envStr('PROJECT_PATH', '.');
  const outputDir = path.resolve(envStr('OUTPUT_DIR', '.veracode-build'));
  const skipDiscovery = envBool('SKIP_DISCOVERY', false);
  const configFile = envStr('CONFIG_FILE', '');

  ensureDir(outputDir);

  let discovery;
  let plan;
  let discoveryStatus = 'executed';

  const overrides = {
    projectPath,
    language: envStr('LANGUAGE', 'auto'),
    framework: envStr('FRAMEWORK', 'auto'),
    runtimeVersion: envStr('RUNTIME_VERSION', 'auto'),
    buildSystem: envStr('BUILD_SYSTEM', 'auto'),
    packageManager: envStr('PACKAGE_MANAGER', 'auto'),
    packagingStrategy: envStr('PACKAGING_STRATEGY', 'auto'),
    javaPackageMode: envStr('JAVA_PACKAGE_MODE', 'compiled'),
    runTests: envBool('RUN_TESTS', false)
  };

  if (skipDiscovery && configFile && require('fs').existsSync(configFile)) {
    const config = readJson(configFile);
    plan = mergePlanFromConfig(config, overrides);
    discovery = {
      schemaVersion: 1,
      ...config.discovery,
      confidence: config.discovery?.confidence || 'HIGH',
      projectPath: plan.projectPath,
      packagingStrategy: plan.strategy,
      requiredEnvironmentVariables: plan.requiredEnvironmentVariables,
      fromCache: true
    };
    discoveryStatus = 'skipped_cached';
  } else {
    discovery = discover(source, overrides);
    plan = toBuildPlan(discovery, overrides);
  }

  const discoveryOut = path.join(outputDir, 'discovery-result.json');
  const planOut = path.join(outputDir, 'build-plan.json');
  writeJson(discoveryOut, discovery);
  writeJson(planOut, plan);

  const elapsed = timingMs(start) / 1000;
  setOutputs({
    language: plan.language,
    framework: plan.framework,
    runtime_version: plan.runtimeVersion,
    build_system: plan.buildSystem,
    package_manager: plan.packageManager,
    packaging_strategy: plan.strategy,
    project_path: plan.projectPath,
    discovery_confidence: plan.confidence,
    required_env_vars: (plan.requiredEnvironmentVariables || []).join(','),
    doctor_profile: plan.doctorProfile,
    discovery_status: discoveryStatus,
    discovery_result_path: discoveryOut,
    build_plan_path: planOut,
    discovery_seconds: elapsed.toFixed(3)
  });

  console.log(`Discovery: ${discoveryStatus} em ${elapsed.toFixed(1)}s`);
  console.log(
    `language=${plan.language} buildSystem=${plan.buildSystem} framework=${plan.framework} strategy=${plan.strategy}`
  );
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
