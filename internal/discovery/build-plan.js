'use strict';

const { validateBuildPlan } = require('../utils/schemas/validate');
const { isAuto } = require('../utils/common/io');

/**
 * Converte DiscoveryResult + overrides em BuildPlan normalizado.
 */
function toBuildPlan(discovery, overrides = {}) {
  const strategy = !isAuto(overrides.packagingStrategy)
    ? overrides.packagingStrategy
    : discovery.packagingStrategy ||
      (discovery.language === 'java'
        ? 'HYBRID'
        : discovery.language === 'javascript' || discovery.language === 'typescript'
          ? 'SOURCE_PACKAGE'
          : 'BUILD_REQUIRED');

  const javaMode = String(overrides.javaPackageMode || 'compiled').toLowerCase();
  let effectiveStrategy = strategy;
  let doctorProfile = discovery.doctorProfile;
  let artifactType = discovery.packaging || 'zip';
  let patterns = discovery.artifactCandidates || [];

  if (discovery.language === 'java') {
    if (javaMode === 'source') {
      effectiveStrategy = 'SOURCE_PACKAGE';
      doctorProfile = 'java-source';
      artifactType = 'zip';
      patterns = ['**/*.java'];
    } else {
      effectiveStrategy = strategy === 'HYBRID' ? 'BUILD_REQUIRED' : strategy;
      doctorProfile = 'java-compiled';
    }
  }

  const plan = {
    schemaVersion: 1,
    language: discovery.language,
    ecosystem: discovery.ecosystem || discovery.language,
    buildSystem: discovery.buildSystem,
    runtimeVersion: discovery.runtimeVersion || 'auto',
    framework: discovery.framework || 'none',
    strategy: effectiveStrategy,
    projectPath: discovery.projectPath || '.',
    projectType: discovery.projectType || 'application',
    packageManager: discovery.packageManager || discovery.buildSystem,
    wrapper: discovery.wrapper || null,
    restoreRequired: Boolean(discovery.restoreRequired),
    runTests: overrides.runTests === true || overrides.runTests === 'true',
    runnerRequirements: discovery.runnerRequirements || { os: ['linux', 'windows', 'macos'] },
    dependencyManager: discovery.packageManager || discovery.buildSystem,
    requiredEnvironmentVariables: discovery.requiredEnvironmentVariables || [],
    artifact: {
      type: artifactType,
      patterns
    },
    doctorProfile: doctorProfile || 'generic',
    confidence: discovery.confidence || 'MEDIUM',
    warnings: discovery.warnings || [],
    notImplemented: Boolean(discovery.notImplemented),
    testProjects: discovery.testProjects || [],
    targetFrameworks: discovery.targetFrameworks || [],
    hasLockfile: Boolean(discovery.hasLockfile),
    privateRegistryDetected: Boolean(discovery.privateRegistryDetected),
    javaPackageMode: javaMode
  };

  return validateBuildPlan(plan);
}

/**
 * Merge: Explicit User Input > Valid Cached Config > Discovery
 */
function mergePlanFromConfig(config, overrides = {}) {
  const d = config.discovery || {};
  const b = config.builder || {};
  const discoveryLike = {
    schemaVersion: 1,
    language: !isAuto(overrides.language) ? overrides.language : d.language,
    framework: !isAuto(overrides.framework) ? overrides.framework : d.framework,
    runtimeVersion: !isAuto(overrides.runtimeVersion) ? overrides.runtimeVersion : d.runtimeVersion,
    buildSystem: !isAuto(overrides.buildSystem) ? overrides.buildSystem : d.buildSystem,
    packageManager: !isAuto(overrides.packageManager) ? overrides.packageManager : d.packageManager,
    projectType: d.projectType,
    projectPath:
      overrides.projectPath && overrides.projectPath !== '.'
        ? overrides.projectPath
        : config.projectPath || d.projectPath || '.',
    packagingStrategy: !isAuto(overrides.packagingStrategy)
      ? overrides.packagingStrategy
      : b.strategy || d.packagingStrategy,
    artifactCandidates: b.artifactPatterns || d.artifactCandidates || [],
    requiredEnvironmentVariables: (config.dependencies || {}).requiredEnvironmentVariables || [],
    confidence: d.confidence || 'HIGH',
    warnings: [],
    doctorProfile: (config.doctor || {}).profile,
    wrapper: b.wrapper,
    restoreRequired: true,
    ecosystem: d.language === 'java' ? 'jvm' : d.language === 'dotnet' ? 'dotnet' : 'node',
    packaging: (b.artifactPatterns || [''])[0]?.includes('.war')
      ? 'war'
      : (b.artifactPatterns || [''])[0]?.includes('.ear')
        ? 'ear'
        : 'jar',
    privateRegistryDetected: Boolean((config.dependencies || {}).privateRegistryDetected),
    runnerRequirements: b.runnerRequirements,
    testProjects: b.testProjects || [],
    targetFrameworks: d.targetFrameworks || [],
    hasLockfile: Boolean(d.hasLockfile)
  };

  return toBuildPlan(discoveryLike, {
    ...overrides,
    runTests: overrides.runTests ?? b.runTests
  });
}

module.exports = { toBuildPlan, mergePlanFromConfig };
