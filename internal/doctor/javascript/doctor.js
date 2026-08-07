'use strict';

const path = require('path');
const { listZipEntries, finalizeStatus, genericChecks } = require('../common');

function doctorJavaScript(artifactPath, plan = {}) {
  const checks = [...genericChecks(artifactPath)];
  if (checks.some((c) => c.status === 'FAIL')) {
    return { status: finalizeStatus(checks), checks, language: plan.language || 'javascript', artifact: artifactPath };
  }

  let entries = [];
  try {
    entries = listZipEntries(artifactPath).map((e) => e.replace(/\\/g, '/'));
  } catch (err) {
    checks.push({ id: 'JS_ARCHIVE', status: 'FAIL', message: err.message });
    return { status: 'INVALID', checks, language: plan.language || 'javascript', artifact: artifactPath };
  }

  const lower = entries.map((e) => e.toLowerCase());
  const sourceFiles = lower.filter((e) => /\.(js|jsx|ts|tsx|mjs|cjs|vue)$/.test(e) && !e.includes('node_modules/'));
  const minified = lower.filter((e) => /\.min\.js$/.test(e) || /(^|\/)(all|bundle|vendor)\.js$/.test(e));
  const hasNodeModules = lower.some((e) => e.includes('node_modules/'));
  const hasPackageJson = lower.some((e) => e.endsWith('package.json'));
  const hasLock =
    lower.some((e) => e.endsWith('package-lock.json')) ||
    lower.some((e) => e.endsWith('npm-shrinkwrap.json')) ||
    lower.some((e) => e.endsWith('yarn.lock')) ||
    lower.some((e) => e.endsWith('pnpm-lock.yaml'));
  const onlyDist =
    sourceFiles.length > 0 &&
    sourceFiles.every((e) => /(^|\/)(dist|build|\.next|out)\//.test(e)) &&
    !lower.some((e) => /\.(ts|tsx)$/.test(e) && !/(dist|build|\.next)\//.test(e));

  if (sourceFiles.length === 0 || (minified.length > 0 && sourceFiles.every((e) => minified.includes(e)))) {
    checks.push({
      id: 'JS_SOURCE_READABLE',
      status: 'FAIL',
      message: 'Nao ha source legivel suficiente; apenas bundle/minificado ou nenhum source.'
    });
  } else if (minified.length > 0) {
    checks.push({
      id: 'JS_SOURCE_READABLE',
      status: 'WARN',
      message: `Arquivos aparentemente minificados/concatenados presentes (${minified.length}). A Veracode ignora nomes como *.min.js / all.js.`
    });
  } else {
    checks.push({ id: 'JS_SOURCE_READABLE', status: 'PASS' });
  }

  if (onlyDist) {
    checks.push({
      id: 'JS_NO_DIST_ONLY',
      status: 'FAIL',
      message: 'Artifact parece conter apenas dist/build/.next sem source original.'
    });
  } else {
    checks.push({ id: 'JS_NO_DIST_ONLY', status: 'PASS' });
  }

  if (plan.language === 'typescript' || lower.some((e) => e.endsWith('.ts') || e.endsWith('.tsx'))) {
    const hasTs = lower.some((e) => e.endsWith('.ts') || e.endsWith('.tsx'));
    checks.push(
      hasTs
        ? { id: 'TS_SOURCE_PRESERVED', status: 'PASS' }
        : { id: 'TS_SOURCE_PRESERVED', status: 'WARN', message: 'TypeScript esperado mas .ts/.tsx nao encontrados.' }
    );
  }

  checks.push(
    hasPackageJson
      ? { id: 'JS_PACKAGE_JSON', status: 'PASS' }
      : { id: 'JS_PACKAGE_JSON', status: 'WARN', message: 'package.json ausente.' }
  );

  checks.push(
    hasLock
      ? { id: 'JS_LOCKFILE_PRESENT', status: 'PASS' }
      : { id: 'JS_LOCKFILE_PRESENT', status: 'WARN', message: 'Lockfile ausente; SCA pode ficar limitado.' }
  );

  if (hasNodeModules && hasLock) {
    checks.push({
      id: 'JS_NODE_MODULES_EXCLUDED',
      status: 'WARN',
      message: 'node_modules presente apesar de lockfile. A Veracode recomenda exclusao.'
    });
  } else if (hasNodeModules && !hasLock) {
    checks.push({
      id: 'JS_NODE_MODULES_EXCLUDED',
      status: 'WARN',
      message: 'node_modules presente sem lockfile.'
    });
  } else {
    checks.push({ id: 'JS_NODE_MODULES_EXCLUDED', status: 'PASS' });
  }

  const maps = entries.filter((e) => e.toLowerCase().endsWith('.map'));
  if (maps.length > 0) {
    checks.push({
      id: 'JS_SOURCEMAP_CONTENT',
      status: 'WARN',
      message: 'Source maps presentes; valide sources + sourcesContent (nao inspecionado byte-a-byte neste MVP).'
    });
  }

  const status = finalizeStatus(checks);
  return {
    status,
    language: plan.language || 'javascript',
    artifact: path.basename(artifactPath),
    checks,
    warnings: checks.filter((c) => c.status === 'WARN').map((c) => c.message || c.id),
    disclaimer:
      'Veracode-ready according to documented packaging requirements. Este Doctor nao reproduz o prescan proprietario da Veracode.'
  };
}

module.exports = { doctorJavaScript };
