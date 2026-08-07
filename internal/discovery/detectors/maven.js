'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Detector Java + Maven.
 */

function exists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

function readText(root, rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) return '';
  return fs.readFileSync(p, 'utf8');
}

function detectJavaVersion(root, pom) {
  const patterns = [
    /<maven\.compiler\.release>\s*([^<]+)/i,
    /<maven\.compiler\.source>\s*([^<]+)/i,
    /<maven\.compiler\.target>\s*([^<]+)/i,
    /<release>\s*([^<]+)/i,
    /<java\.version>\s*([^<]+)/i,
    /<jdk\.version>\s*([^<]+)/i
  ];
  for (const re of patterns) {
    const m = pom.match(re);
    if (m) return String(m[1]).trim();
  }

  const javaVersionFile = readText(root, '.java-version').trim();
  if (javaVersionFile) return javaVersionFile.split(/\s+/)[0];

  const toolVersions = readText(root, '.tool-versions');
  const tv = toolVersions.match(/^java\s+(\S+)/m);
  if (tv) return tv[1];

  return '';
}

function detectFramework(pom) {
  if (/spring-boot/i.test(pom)) return 'spring-boot';
  if (/org\.springframework/i.test(pom)) return 'spring';
  if (/quarkus/i.test(pom)) return 'quarkus';
  if (/jakarta\./i.test(pom)) return 'jakarta';
  if (/javax\.servlet|javaee/i.test(pom)) return 'javaee';
  return 'none';
}

function detectPackaging(pom) {
  const m = pom.match(/<packaging>\s*([^<]+)/i);
  if (m) return String(m[1]).trim().toLowerCase();
  return 'jar';
}

function detectRequiredEnv(pom) {
  const names = new Set();
  const envRefs = pom.matchAll(/\$\{env\.([A-Z][A-Z0-9_]*)\}/g);
  for (const m of envRefs) names.add(m[1]);
  if (/server[^<]*password|username.*repository|id>\s*[^<]*(nexus|artifactory|github)/i.test(pom)) {
    // hints only when private repo markers exist without inventing values
    if (/MAVEN_USERNAME|MAVEN_PASSWORD|MAVEN_TOKEN/i.test(pom)) {
      for (const n of ['MAVEN_USERNAME', 'MAVEN_PASSWORD', 'MAVEN_TOKEN']) {
        if (pom.includes(n)) names.add(n);
      }
    }
  }
  return [...names];
}

/**
 * @param {string} root
 * @returns {object|null}
 */
function detect(root) {
  if (!exists(root, 'pom.xml')) return null;

  const pom = readText(root, 'pom.xml');
  const hasWrapper = exists(root, 'mvnw') || exists(root, 'mvnw.cmd');
  const packaging = detectPackaging(pom);
  const framework = detectFramework(pom);
  const runtimeVersion = detectJavaVersion(root, pom);
  const requiredEnvironmentVariables = detectRequiredEnv(pom);
  const shade = /maven-shade-plugin/i.test(pom);

  const artifactPatterns =
    packaging === 'war'
      ? ['target/*.war']
      : packaging === 'ear'
        ? ['target/*.ear']
        : framework === 'quarkus'
          ? ['target/*-runner.jar', 'target/*.jar']
          : ['target/*.jar'];

  return {
    schemaVersion: 1,
    language: 'java',
    ecosystem: 'jvm',
    framework,
    runtimeVersion: runtimeVersion || 'auto',
    buildSystem: 'maven',
    packageManager: 'maven',
    projectType: packaging === 'war' || packaging === 'ear' ? 'web' : 'library-or-app',
    projectPath: '.',
    packagingStrategy: 'HYBRID',
    artifactCandidates: artifactPatterns,
    packaging,
    wrapper: hasWrapper ? (process.platform === 'win32' && exists(root, 'mvnw.cmd') ? 'mvnw.cmd' : './mvnw') : 'mvn',
    requiredEnvironmentVariables,
    confidence: runtimeVersion ? 'HIGH' : 'MEDIUM',
    warnings: shade
      ? ['Maven Shade detectado. A Veracode recomenda desabilitar Shade quando possivel para melhor analise/SCA.']
      : [],
    doctorProfile: 'java-compiled',
    restoreRequired: true,
    privateRegistryDetected: requiredEnvironmentVariables.length > 0
  };
}

module.exports = { detect };
