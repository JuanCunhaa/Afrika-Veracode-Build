'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { ensureDir } = require('../common/io');

/**
 * Empacota arquivos/diretorios em ZIP para envio Veracode.
 * Usa PowerShell Compress-Archive no Windows e zip no Unix.
 */

/**
 * @param {string[]} sources Absolute paths to files or dirs
 * @param {string} outZip Absolute path to zip
 * @param {{ cwd?: string, excludeNames?: string[] }} [options]
 */
function createZip(sources, outZip, options = {}) {
  ensureDir(path.dirname(outZip));
  if (fs.existsSync(outZip)) {
    fs.unlinkSync(outZip);
  }

  const absSources = sources.map((s) => path.resolve(s)).filter((s) => fs.existsSync(s));
  if (absSources.length === 0) {
    throw new Error('Nenhum arquivo/diretorio encontrado para empacotar');
  }

  const isWin = process.platform === 'win32';
  if (isWin) {
    // staging dir to avoid nesting issues
    const staging = path.join(path.dirname(outZip), `.pack-staging-${Date.now()}`);
    ensureDir(staging);
    try {
      for (const src of absSources) {
        const base = path.basename(src);
        const dest = path.join(staging, base);
        copyRecursive(src, dest, options.excludeNames || []);
      }
      const ps = ['Compress-Archive', '-Path', `"${staging}\\*"`, '-DestinationPath', `"${outZip}"`, '-Force'].join(
        ' '
      );
      execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { stdio: 'pipe' });
    } finally {
      fs.rmSync(staging, { recursive: true, force: true });
    }
  } else {
    const staging = path.join(path.dirname(outZip), `.pack-staging-${Date.now()}`);
    ensureDir(staging);
    try {
      for (const src of absSources) {
        const base = path.basename(src);
        copyRecursive(src, path.join(staging, base), options.excludeNames || []);
      }
      execFileSync('zip', ['-r', '-q', outZip, '.'], { cwd: staging, stdio: 'pipe' });
    } finally {
      fs.rmSync(staging, { recursive: true, force: true });
    }
  }

  if (!fs.existsSync(outZip) || fs.statSync(outZip).size === 0) {
    throw new Error(`Falha ao criar ZIP: ${outZip}`);
  }
  return outZip;
}

/**
 * Empacota conteudo de um diretorio mantendo estrutura relativa (sem pasta raiz extra).
 * @param {string} sourceDir
 * @param {string} outZip
 * @param {{ excludeNames?: string[], excludeGlobs?: string[] }} [options]
 */
function zipDirectoryContents(sourceDir, outZip, options = {}) {
  ensureDir(path.dirname(outZip));
  if (fs.existsSync(outZip)) fs.unlinkSync(outZip);

  const staging = path.join(path.dirname(outZip), `.pack-staging-${Date.now()}`);
  ensureDir(staging);
  try {
    copyRecursive(sourceDir, staging, options.excludeNames || [], options.excludeGlobs || [], true);
    if (process.platform === 'win32') {
      const ps = ['Compress-Archive', '-Path', `"${staging}\\*"`, '-DestinationPath', `"${outZip}"`, '-Force'].join(
        ' '
      );
      execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { stdio: 'pipe' });
    } else {
      execFileSync('zip', ['-r', '-q', outZip, '.'], { cwd: staging, stdio: 'pipe' });
    }
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
  return outZip;
}

/**
 * @param {string} src
 * @param {string} dest
 * @param {string[]} excludeNames
 * @param {string[]} [excludeGlobs]
 * @param {boolean} [mergeRoot]
 */
function copyRecursive(src, dest, excludeNames = [], excludeGlobs = [], mergeRoot = false) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    const base = path.basename(src);
    if (!mergeRoot && excludeNames.includes(base)) return;
    if (!mergeRoot) ensureDir(dest);
    else ensureDir(dest);

    for (const name of fs.readdirSync(src)) {
      if (excludeNames.includes(name)) continue;
      if (matchesAnyGlob(name, excludeGlobs)) continue;
      const from = path.join(src, name);
      const childDest = path.join(dest, name);
      copyRecursive(from, childDest, excludeNames, excludeGlobs, false);
    }
  } else if (stat.isFile()) {
    if (matchesAnyGlob(path.basename(src), excludeGlobs)) return;
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
  }
}

function matchesAnyGlob(name, globs) {
  if (!globs || globs.length === 0) return false;
  return globs.some((g) => {
    const re = new RegExp(
      `^${String(g)
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')}$`,
      'i'
    );
    return re.test(name);
  });
}

/**
 * Expand directory segments that may contain `*` (one path level only).
 * @param {string} root
 * @param {string[]} dirParts
 * @returns {string[]}
 */
function expandDirGlobs(root, dirParts) {
  let dirs = [root];
  for (const part of dirParts) {
    if (!part || part === '.') continue;
    const next = [];
    for (const dir of dirs) {
      if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;
      if (part === '*') {
        for (const name of fs.readdirSync(dir)) {
          const child = path.join(dir, name);
          try {
            if (fs.statSync(child).isDirectory()) next.push(child);
          } catch {
            /* ignore */
          }
        }
      } else {
        next.push(path.join(dir, part));
      }
    }
    dirs = next;
  }
  return dirs;
}

/**
 * Resolve artifact globs relative to projectPath (e.g. target/*.jar, star/target/*.jar).
 * A directory-segment star expands one level (not recursive).
 * @param {string} projectPath
 * @param {string[]} patterns
 * @param {{ excludeSuffixes?: string[] }} [opts]
 * @returns {string[]}
 */
function resolveArtifactPatterns(projectPath, patterns, opts = {}) {
  const excludeSuffixes = opts.excludeSuffixes || ['-sources.jar', '-javadoc.jar', '-tests.jar', '-test-fixtures.jar'];
  const found = [];
  const seen = new Set();
  for (const pattern of patterns || []) {
    const parts = String(pattern || '')
      .split('/')
      .filter((p) => p.length > 0);
    if (parts.length === 0) continue;
    const fileGlob = parts.pop();
    const dirs = parts.length === 0 ? [projectPath] : expandDirGlobs(projectPath, parts);
    const re = globToRegExp(fileGlob);
    for (const dir of dirs) {
      if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;
      for (const name of fs.readdirSync(dir)) {
        if (!re.test(name)) continue;
        if (excludeSuffixes.some((s) => name.endsWith(s))) continue;
        const abs = path.join(dir, name);
        if (seen.has(abs)) continue;
        seen.add(abs);
        found.push(abs);
      }
    }
  }
  return found;
}

function globToRegExp(glob) {
  const escaped = String(glob)
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i');
}

module.exports = {
  createZip,
  zipDirectoryContents,
  copyRecursive,
  resolveArtifactPatterns
};
