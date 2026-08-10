'use strict';

const fs = require('fs');
const path = require('path');

function exists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

function readText(root, rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) return '';
  return fs.readFileSync(p, 'utf8');
}

function findBuildFile(root) {
  for (const f of ['build.gradle.kts', 'build.gradle', 'settings.gradle.kts', 'settings.gradle']) {
    if (exists(root, f)) return f;
  }
  return null;
}

function detectJavaVersion(root, build) {
  // VERSION_1_8 must be matched before VERSION_(\d+) (otherwise "1" is captured).
  const patterns = [
    /JavaLanguageVersion\.of\((\d+)\)/,
    /sourceCompatibility\s*=\s*['"]([\d.]+)['"]/,
    /targetCompatibility\s*=\s*['"]([\d.]+)['"]/,
    /sourceCompatibility\s*=\s*(\d+(?:\.\d+)?)\b/,
    /targetCompatibility\s*=\s*(\d+(?:\.\d+)?)\b/,
    /JavaVersion\.VERSION_1_(\d+)/,
    /JavaVersion\.VERSION_(\d+)/,
    /jvmTarget\s*=\s*['"]([\d.]+)['"]/
  ];
  for (const re of patterns) {
    const m = build.match(re);
    if (m) return m[1];
  }
  const props = readText(root, 'gradle.properties');
  const jp = props.match(/java(?:Version|Compat(?:ibility)?)?\s*=\s*([\d.]+)/i);
  if (jp) return jp[1];

  const javaVersionFile = readText(root, '.java-version').trim();
  if (javaVersionFile) return javaVersionFile.split(/\s+/)[0];
  const toolVersions = readText(root, '.tool-versions');
  const tv = toolVersions.match(/^java\s+(\S+)/m);
  if (tv) return tv[1];
  return '';
}

function detectFramework(build) {
  if (/org\.springframework\.boot|spring-boot/i.test(build)) return 'spring-boot';
  if (/springframework/i.test(build)) return 'spring';
  if (/io\.quarkus|quarkus/i.test(build)) return 'quarkus';
  if (/jakarta/i.test(build)) return 'jakarta';
  return 'none';
}

function detectWar(build) {
  return /war\b|id\(['"]war['"]\)|plugin\(['"]war['"]\)/i.test(build);
}

/**
 * Parse `include 'core'` / `include("api", "core")` from settings.gradle(.kts).
 * Multi-module jars land under `<module>/build/libs/`, not root `build/libs/`.
 * @param {string} root
 * @returns {string[]}
 */
function detectIncludedModules(root) {
  const settings = readText(root, 'settings.gradle.kts') || readText(root, 'settings.gradle');
  if (!settings) return [];
  const modules = [];
  for (const m of settings.matchAll(/include\s*\(?([^)\n]+)\)?/gi)) {
    for (const q of String(m[1]).matchAll(/['"]([^'"]+)['"]/g)) {
      const name = String(q[1]).replace(/^:/, '').replace(/:/g, '/').trim();
      if (name && name !== 'buildSrc') modules.push(name);
    }
  }
  return [...new Set(modules)];
}

/**
 * @param {string} root
 * @returns {object|null}
 */
function detect(root) {
  const buildFile = findBuildFile(root);
  const hasWrapper =
    exists(root, 'gradlew') || exists(root, 'gradlew.bat') || exists(root, 'gradle/wrapper/gradle-wrapper.properties');

  if (!buildFile && !hasWrapper) return null;
  // Require a build or settings file to avoid false positives
  if (!buildFile) return null;

  const build =
    readText(root, 'build.gradle.kts') ||
    readText(root, 'build.gradle') ||
    readText(root, 'settings.gradle.kts') ||
    readText(root, 'settings.gradle');

  // Prefer root build for version/framework; also scan settings + first-level modules.
  const modules = detectIncludedModules(root);
  const moduleBuildText = modules
    .map((mod) => readText(root, `${mod}/build.gradle.kts`) || readText(root, `${mod}/build.gradle`))
    .join('\n');
  const scanText = `${build}\n${moduleBuildText}`;

  const runtimeVersion = detectJavaVersion(root, scanText);
  const framework = detectFramework(scanText);
  const isWar = detectWar(scanText);
  const wrapper =
    process.platform === 'win32' && exists(root, 'gradlew.bat')
      ? 'gradlew.bat'
      : exists(root, 'gradlew')
        ? './gradlew'
        : 'gradle';

  const rootPatterns = isWar ? ['build/libs/*.war', 'build/libs/*.jar'] : ['build/libs/*.jar'];
  const modulePatterns = modules.flatMap((mod) =>
    isWar ? [`${mod}/build/libs/*.war`, `${mod}/build/libs/*.jar`] : [`${mod}/build/libs/*.jar`]
  );
  const artifactCandidates =
    modules.length > 0
      ? [...modulePatterns, ...rootPatterns, '*/build/libs/*.jar', '*/build/libs/*.war']
      : rootPatterns;

  return {
    schemaVersion: 1,
    language: 'java',
    ecosystem: 'jvm',
    framework,
    runtimeVersion: runtimeVersion || 'auto',
    buildSystem: 'gradle',
    packageManager: 'gradle',
    projectType: isWar ? 'web' : 'library-or-app',
    projectPath: '.',
    packagingStrategy: 'HYBRID',
    artifactCandidates,
    packaging: isWar ? 'war' : 'jar',
    wrapper,
    requiredEnvironmentVariables: [],
    confidence: runtimeVersion ? 'HIGH' : 'MEDIUM',
    warnings: [],
    doctorProfile: 'java-compiled',
    restoreRequired: true,
    privateRegistryDetected: false
  };
}

module.exports = { detect };
