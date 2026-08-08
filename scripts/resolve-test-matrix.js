'use strict';

/**
 * Resolve tests/test-matrix.json for a profile → GitHub Actions matrix outputs.
 *
 * Env:
 *   MATRIX_PROFILE = pr | full | release
 *   GITHUB_OUTPUT   = (Actions) path to append outputs
 *
 * Local:
 *   node scripts/resolve-test-matrix.js --profile pr
 *   node scripts/resolve-test-matrix.js --profile full --print-table
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MATRIX_PATH = path.join(ROOT, 'tests/test-matrix.json');

function arg(name, fallback = '') {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function load() {
  return JSON.parse(fs.readFileSync(MATRIX_PATH, 'utf8'));
}

function filterEntries(entries, profile) {
  return (entries || []).filter((e) => Array.isArray(e.profiles) && e.profiles.includes(profile));
}

function toMatrixInclude(entries, mapFn) {
  return filterEntries(entries, process.env.MATRIX_PROFILE || arg('profile', 'pr')).map(mapFn);
}

function setOutput(name, value) {
  const out = process.env.GITHUB_OUTPUT;
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  if (out) {
    // multiline-safe for JSON arrays
    if (str.includes('\n')) {
      fs.appendFileSync(out, `${name}<<EOF\n${str}\nEOF\n`);
    } else {
      fs.appendFileSync(out, `${name}=${str}\n`);
    }
  }
  return str;
}

function main() {
  const profile = process.env.MATRIX_PROFILE || arg('profile', 'pr');
  if (!['pr', 'full', 'release'].includes(profile)) {
    console.error(`Invalid MATRIX_PROFILE: ${profile}`);
    process.exit(1);
  }

  const doc = load();
  const profileCfg = doc.profiles[profile];
  process.env.MATRIX_PROFILE = profile;

  const javaMaven = toMatrixInclude(doc.javaMaven, (e) => ({
    case: e.case,
    java: String(e.java),
    scenario: e.scenario,
    experimental: e.stability === 'experimental',
    tech: 'Java Maven',
    version: String(e.java)
  }));

  const javaGradle = toMatrixInclude(doc.javaGradle, (e) => ({
    case: e.case,
    java: String(e.java),
    scenario: e.scenario,
    experimental: e.stability === 'experimental',
    tech: 'Java Gradle',
    version: String(e.java)
  }));

  const javascript = toMatrixInclude(doc.javascript, (e) => ({
    case: e.case,
    node: String(e.node || doc.runnerDefaults.node),
    scenario: e.scenario,
    experimental: e.stability === 'experimental',
    tech: 'JavaScript',
    version: `Node ${e.node || doc.runnerDefaults.node}`
  }));

  const typescript = toMatrixInclude(doc.typescript, (e) => ({
    case: e.case,
    node: String(e.node || doc.runnerDefaults.node),
    scenario: e.scenario,
    experimental: e.stability === 'experimental',
    tech: 'TypeScript',
    version: `Node ${e.node || doc.runnerDefaults.node}`
  }));

  const dotnetModern = toMatrixInclude(doc.dotnetModern, (e) => ({
    case: e.case,
    sdk: e.sdk,
    scenario: e.scenario,
    experimental: e.stability === 'experimental',
    tech: '.NET',
    version: String(e.version)
  }));

  const dotnetFramework = toMatrixInclude(doc.dotnetFramework, (e) => ({
    case: e.case,
    scenario: e.scenario,
    experimental: e.stability === 'experimental',
    tech: '.NET Framework',
    version: String(e.version),
    os: e.os || 'windows-latest'
  }));

  // GitHub requires at least one include entry — use a sentinel skip if empty
  const ensure = (arr, sentinel) => (arr.length > 0 ? arr : [sentinel]);

  const outputs = {
    profile,
    fail_fast: String(!!profileCfg.failFast),
    run_unit: 'true',
    run_negative: 'true',
    run_security: 'true',
    run_contract: 'true',
    run_full_extras: String(profile === 'full' || profile === 'release'),
    run_release: String(profile === 'release'),
    java_maven: ensure(javaMaven, {
      case: '_skip',
      java: '17',
      scenario: 'skip',
      experimental: false,
      tech: 'Java Maven',
      version: '-'
    }),
    java_gradle: ensure(javaGradle, {
      case: '_skip',
      java: '17',
      scenario: 'skip',
      experimental: false,
      tech: 'Java Gradle',
      version: '-'
    }),
    javascript: ensure(javascript, {
      case: '_skip',
      node: '20',
      scenario: 'skip',
      experimental: false,
      tech: 'JavaScript',
      version: '-'
    }),
    typescript: ensure(typescript, {
      case: '_skip',
      node: '20',
      scenario: 'skip',
      experimental: false,
      tech: 'TypeScript',
      version: '-'
    }),
    dotnet_modern: ensure(dotnetModern, {
      case: '_skip',
      sdk: '8.0.x',
      scenario: 'skip',
      experimental: false,
      tech: '.NET',
      version: '-'
    }),
    dotnet_framework: ensure(dotnetFramework, {
      case: '_skip',
      scenario: 'skip',
      experimental: false,
      tech: '.NET Framework',
      version: '-',
      os: 'windows-latest'
    }),
    java_maven_count: String(javaMaven.length),
    java_gradle_count: String(javaGradle.length),
    javascript_count: String(javascript.length),
    typescript_count: String(typescript.length),
    dotnet_modern_count: String(dotnetModern.length),
    dotnet_framework_count: String(dotnetFramework.length)
  };

  for (const [k, v] of Object.entries(outputs)) {
    setOutput(k, v);
  }

  console.log(`Resolved matrix profile=${profile} failFast=${profileCfg.failFast}`);
  console.log(
    `counts maven=${javaMaven.length} gradle=${javaGradle.length} js=${javascript.length} ts=${typescript.length} dotnet=${dotnetModern.length} netfx=${dotnetFramework.length}`
  );

  if (hasFlag('print-table') || process.env.GITHUB_STEP_SUMMARY) {
    const lines = [
      `## Test matrix (${profile})`,
      '',
      profileCfg.description || '',
      '',
      '| Technology | Version | Scenario | Stability |',
      '| --- | --- | --- | --- |'
    ];
    const all = [...javaMaven, ...javaGradle, ...javascript, ...typescript, ...dotnetModern, ...dotnetFramework];
    for (const row of all) {
      const stab = row.experimental ? 'Experimental' : 'Stable';
      lines.push(`| ${row.tech} | ${row.version} | ${row.scenario} | ${stab} |`);
    }
    lines.push('');
    const md = lines.join('\n');
    if (process.env.GITHUB_STEP_SUMMARY) {
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md}\n`);
    }
    if (hasFlag('print-table')) console.log(md);
  }

  if (hasFlag('print-support')) {
    console.log('## Support summary');
    console.log('');
    console.log('| Technology | Versions | OS | PR Tested | Full Tested | Release Required | Stability |');
    console.log('| --- | --- | --- | --- | --- | --- | --- |');
    for (const row of doc.supportTable || []) {
      console.log(
        `| ${row.technology} | ${row.versions} | ${row.os} | ${row.prTested} | ${row.fullTested} | ${row.releaseRequired} | ${row.stability} |`
      );
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = { load, filterEntries, MATRIX_PATH };
