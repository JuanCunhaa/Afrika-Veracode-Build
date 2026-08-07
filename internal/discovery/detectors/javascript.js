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

function detectPackageManager(root) {
  if (exists(root, 'pnpm-lock.yaml')) return 'pnpm';
  if (exists(root, 'yarn.lock')) return 'yarn';
  if (exists(root, 'package-lock.json') || exists(root, 'npm-shrinkwrap.json')) return 'npm';
  return 'npm';
}

function detectNodeVersion(root, pkg) {
  if (pkg.engines && pkg.engines.node) {
    return (
      String(pkg.engines.node)
        .replace(/[^0-9.].*$/, '')
        .replace(/^[^0-9]*/, '') || String(pkg.engines.node)
    );
  }
  const nvm = readText(root, '.nvmrc').trim();
  if (nvm) return nvm.replace(/^v/, '');
  const nodeVersion = readText(root, '.node-version').trim();
  if (nodeVersion) return nodeVersion.replace(/^v/, '');
  const toolVersions = readText(root, '.tool-versions');
  const tv = toolVersions.match(/^nodejs\s+(\S+)/m) || toolVersions.match(/^node\s+(\S+)/m);
  if (tv) return tv[1].replace(/^v/, '');
  return '';
}

function detectFramework(pkg) {
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const checks = [
    ['next', 'next'],
    ['@nestjs/core', 'nestjs'],
    ['@angular/core', 'angular'],
    ['vue', 'vue'],
    ['svelte', 'svelte'],
    ['react', 'react'],
    ['express', 'express']
  ];
  for (const [dep, name] of checks) {
    if (deps[dep]) return name;
  }
  return 'none';
}

function detectLanguage(root, pkg) {
  if (exists(root, 'tsconfig.json')) return 'typescript';
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  if (deps.typescript) return 'typescript';
  return 'javascript';
}

function detectRequiredEnv(root, pkgText) {
  const names = setOfEnvNames(pkgText);
  for (const f of ['.npmrc', '.yarnrc', '.yarnrc.yml']) {
    const text = readText(root, f);
    for (const n of setOfEnvNames(text)) names.add(n);
    if (/(_authToken|_password|NPM_TOKEN|NODE_AUTH_TOKEN)/i.test(text)) {
      if (/NPM_TOKEN/.test(text) || /\$\{NPM_TOKEN\}/.test(text)) names.add('NPM_TOKEN');
      if (/NODE_AUTH_TOKEN/.test(text) || /\$\{NODE_AUTH_TOKEN\}/.test(text)) names.add('NODE_AUTH_TOKEN');
    }
  }
  return [...names];
}

function setOfEnvNames(text) {
  const names = new Set();
  const re = /\$\{?([A-Z][A-Z0-9_]*(?:TOKEN|PASSWORD|SECRET|USERNAME|AUTH)[A-Z0-9_]*)\}?/g;
  let m;
  while ((m = re.exec(text))) {
    names.add(m[1]);
  }
  return names;
}

/**
 * @param {string} root
 * @returns {object|null}
 */
function detect(root) {
  if (!exists(root, 'package.json')) return null;

  let pkg;
  try {
    pkg = JSON.parse(readText(root, 'package.json'));
  } catch {
    return null;
  }

  const language = detectLanguage(root, pkg);
  const packageManager = detectPackageManager(root);
  const framework = detectFramework(pkg);
  const runtimeVersion = detectNodeVersion(root, pkg);
  const pkgText = readText(root, 'package.json');
  const requiredEnvironmentVariables = detectRequiredEnv(root, pkgText);
  const hasLock =
    exists(root, 'package-lock.json') ||
    exists(root, 'npm-shrinkwrap.json') ||
    exists(root, 'yarn.lock') ||
    exists(root, 'pnpm-lock.yaml');

  return {
    schemaVersion: 1,
    language,
    ecosystem: 'node',
    framework,
    runtimeVersion: runtimeVersion || 'auto',
    buildSystem: packageManager,
    packageManager,
    projectType: 'application',
    projectPath: '.',
    packagingStrategy: 'SOURCE_PACKAGE',
    artifactCandidates: ['.'],
    wrapper: null,
    requiredEnvironmentVariables,
    confidence: hasLock ? 'HIGH' : 'MEDIUM',
    warnings: hasLock
      ? []
      : ['Lockfile nao encontrado. A Veracode recomenda incluir lockfile para SCA; node_modules nao e recomendado.'],
    doctorProfile: language === 'typescript' ? 'typescript-source' : 'javascript-source',
    restoreRequired: false,
    privateRegistryDetected: requiredEnvironmentVariables.length > 0,
    hasLockfile: hasLock
  };
}

module.exports = { detect };
