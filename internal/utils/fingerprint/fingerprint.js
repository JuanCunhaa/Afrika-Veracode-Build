'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Fingerprint SHA-256 de manifests relevantes por ecossistema.
 * Normaliza paths (posix) e ordenacao antes do hash.
 */

const GLOBS_BY_ECOSYSTEM = {
  maven: ['pom.xml', 'mvnw', 'mvnw.cmd', '.mvn/**'],
  gradle: [
    'build.gradle',
    'build.gradle.kts',
    'settings.gradle',
    'settings.gradle.kts',
    'gradle.properties',
    'gradlew',
    'gradlew.bat',
    'gradle/wrapper/gradle-wrapper.properties'
  ],
  javascript: [
    'package.json',
    'package-lock.json',
    'npm-shrinkwrap.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'tsconfig.json',
    '.nvmrc',
    '.node-version',
    '.tool-versions'
  ],
  dotnet: [
    'global.json',
    'Directory.Build.props',
    'Directory.Build.targets',
    'NuGet.Config',
    'nuget.config',
    'packages.config'
  ]
};

/**
 * @param {string} root
 * @param {string} pattern
 * @returns {string[]}
 */
function expandPattern(root, pattern) {
  if (pattern.endsWith('/**')) {
    const base = pattern.slice(0, -3);
    const abs = path.join(root, base);
    if (!fs.existsSync(abs)) return [];
    return walkFiles(abs).map((f) => path.relative(root, f));
  }

  if (pattern.includes('*')) {
    // simples: *.sln, *.csproj na raiz e 1 nivel
    return matchSimpleGlob(root, pattern);
  }

  const abs = path.join(root, pattern);
  return fs.existsSync(abs) ? [pattern] : [];
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
function walkFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '.git' || ent.name === 'bin' || ent.name === 'obj') {
        continue;
      }
      out.push(...walkFiles(full));
    } else if (ent.isFile()) {
      out.push(full);
    }
  }
  return out;
}

/**
 * @param {string} root
 * @param {string} pattern
 * @returns {string[]}
 */
function matchSimpleGlob(root, pattern) {
  const out = [];
  const re = globToRegExp(pattern);
  const files = walkFiles(root);
  for (const abs of files) {
    const rel = toPosix(path.relative(root, abs));
    const base = path.posix.basename(rel);
    if (re.test(rel) || re.test(base)) {
      // para *.sln / *.csproj / *.vbproj / *.slnx
      if (pattern.startsWith('*.')) {
        const ext = pattern.slice(1);
        if (base.endsWith(ext.slice(1)) || base.endsWith(ext)) {
          out.push(rel);
        }
      } else if (re.test(rel)) {
        out.push(rel);
      }
    }
  }
  // filtro mais estrito para extensions
  if (pattern === '*.sln' || pattern === '*.slnx' || pattern === '*.csproj' || pattern === '*.vbproj') {
    const ext = pattern.slice(1);
    return walkFiles(root)
      .map((f) => toPosix(path.relative(root, f)))
      .filter((rel) => rel.toLowerCase().endsWith(ext));
  }
  return out;
}

/**
 * @param {string} pattern
 * @returns {RegExp}
 */
function globToRegExp(pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*');
  return new RegExp(`^${escaped}$`, 'i');
}

/**
 * @param {string} p
 * @returns {string}
 */
function toPosix(p) {
  return String(p).split(path.sep).join('/');
}

/**
 * Resolve lista de arquivos de manifesto para um projeto.
 * @param {string} projectRoot
 * @param {{ buildSystem?: string, language?: string }} meta
 * @returns {string[]}
 */
function collectManifestFiles(projectRoot, meta = {}) {
  const root = path.resolve(projectRoot);
  const system = String(meta.buildSystem || '').toLowerCase();
  const language = String(meta.language || '').toLowerCase();

  /** @type {string[]} */
  let patterns = [];

  if (system === 'maven') {
    patterns = GLOBS_BY_ECOSYSTEM.maven;
  } else if (system === 'gradle') {
    patterns = GLOBS_BY_ECOSYSTEM.gradle;
  } else if (
    language === 'javascript' ||
    language === 'typescript' ||
    system === 'npm' ||
    system === 'yarn' ||
    system === 'pnpm'
  ) {
    patterns = GLOBS_BY_ECOSYSTEM.javascript;
  } else if (language === 'dotnet' || language === 'csharp' || system === 'dotnet' || system === 'msbuild') {
    patterns = [...GLOBS_BY_ECOSYSTEM.dotnet, '*.sln', '*.slnx', '*.csproj', '*.vbproj'];
  } else {
    patterns = [
      ...GLOBS_BY_ECOSYSTEM.maven,
      ...GLOBS_BY_ECOSYSTEM.gradle,
      ...GLOBS_BY_ECOSYSTEM.javascript,
      ...GLOBS_BY_ECOSYSTEM.dotnet,
      '*.sln',
      '*.slnx',
      '*.csproj',
      '*.vbproj'
    ];
  }

  const files = new Set();
  for (const pattern of patterns) {
    for (const rel of expandPattern(root, pattern)) {
      files.add(toPosix(rel));
    }
  }

  return [...files].sort((a, b) => a.localeCompare(b));
}

/**
 * @param {string} projectRoot
 * @param {string[]} relativeFiles
 * @returns {string}
 */
function hashFiles(projectRoot, relativeFiles) {
  const hash = crypto.createHash('sha256');
  const root = path.resolve(projectRoot);
  const sorted = [...relativeFiles].map(toPosix).sort((a, b) => a.localeCompare(b));

  for (const rel of sorted) {
    const abs = path.join(root, rel);
    hash.update(toPosix(rel));
    hash.update('\0');
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      hash.update(fs.readFileSync(abs));
    }
    hash.update('\0');
  }

  return hash.digest('hex');
}

/**
 * @param {string} projectRoot
 * @param {{ buildSystem?: string, language?: string }} meta
 * @returns {{ algorithm: string, value: string, files: string[] }}
 */
function computeFingerprint(projectRoot, meta = {}) {
  const files = collectManifestFiles(projectRoot, meta);
  const value = hashFiles(projectRoot, files);
  return {
    algorithm: 'sha256',
    value,
    files
  };
}

module.exports = {
  GLOBS_BY_ECOSYSTEM,
  collectManifestFiles,
  hashFiles,
  computeFingerprint,
  toPosix
};
