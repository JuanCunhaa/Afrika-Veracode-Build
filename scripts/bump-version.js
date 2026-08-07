'use strict';

/**
 * Bump interativo de versao semver (X.Y.Z).
 *
 * Atualiza:
 *   - package.json / package-lock.json
 *   - uses internos JuanCunhaa/Afrika-Veracode-Build/...@vX.Y.Z
 *
 * Uso:
 *   npm run version:bump          # pergunta X / Y / Z
 *   npm run version:bump -- patch # nao-interativo
 *   npm run version:bump -- minor
 *   npm run version:bump -- major
 */

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const ROOT = path.resolve(__dirname, '..');
const INTERNAL_PREFIX = 'JuanCunhaa/Afrika-Veracode-Build/';

const EXPLAIN = {
  major: {
    letter: 'X',
    name: 'MAJOR (X)',
    meaning:
      'Quebra de compatibilidade: mudancas que exigem o consumidor alterar o workflow (inputs removidos/renomeados, comportamento incompativel, etc.).'
  },
  minor: {
    letter: 'Y',
    name: 'MINOR (Y)',
    meaning:
      'Nova funcionalidade compativel: adiciona recursos sem quebrar usos existentes (novos inputs opcionais, novas linguagens, etc.).'
  },
  patch: {
    letter: 'Z',
    name: 'PATCH (Z)',
    meaning: 'Correcao compativel: bugfix, docs, hardening e ajustes internos sem mudar o contrato publico.'
  }
};

/**
 * @param {string} version
 * @returns {{ major: number, minor: number, patch: number }}
 */
function parseSemver(version) {
  const m = String(version)
    .trim()
    .match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) {
    throw new Error(`Versao invalida em package.json: "${version}" (esperado X.Y.Z)`);
  }
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

/**
 * @param {{ major: number, minor: number, patch: number }} parts
 * @param {'major' | 'minor' | 'patch'} kind
 * @returns {string}
 */
function bump(parts, kind) {
  if (kind === 'major') return `${parts.major + 1}.0.0`;
  if (kind === 'minor') return `${parts.major}.${parts.minor + 1}.0`;
  return `${parts.major}.${parts.minor}.${parts.patch + 1}`;
}

/**
 * @param {string} input
 * @returns {'major' | 'minor' | 'patch' | null}
 */
function normalizeChoice(input) {
  const v = String(input || '')
    .trim()
    .toLowerCase();
  if (['x', '1', 'major', 'maior'].includes(v)) return 'major';
  if (['y', '2', 'minor', 'menor'].includes(v)) return 'minor';
  if (['z', '3', 'patch', 'correcao', 'correção'].includes(v)) return 'patch';
  return null;
}

/**
 * @returns {Promise<'major' | 'minor' | 'patch'>}
 */
function askBumpKind() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const ask = (q) =>
    new Promise((resolve) => {
      rl.question(q, (answer) => resolve(answer));
    });

  return (async () => {
    console.log('');
    console.log('Versionamento semantico (vX.Y.Z) — o que cada parte significa:');
    console.log('');
    console.log(`  X = ${EXPLAIN.major.name}`);
    console.log(`      ${EXPLAIN.major.meaning}`);
    console.log('');
    console.log(`  Y = ${EXPLAIN.minor.name}`);
    console.log(`      ${EXPLAIN.minor.meaning}`);
    console.log('');
    console.log(`  Z = ${EXPLAIN.patch.name}`);
    console.log(`      ${EXPLAIN.patch.meaning}`);
    console.log('');

    for (;;) {
      const answer = await ask('Qual ponto atualizar? [X=major / Y=minor / Z=patch] (ou 1/2/3): ');
      const kind = normalizeChoice(answer);
      if (kind) {
        rl.close();
        return kind;
      }
      console.log('Opcao invalida. Use X, Y, Z (ou 1, 2, 3 / major, minor, patch).');
    }
  })();
}

/**
 * @param {string} dir
 * @param {(name: string) => boolean} filter
 * @param {string[]} out
 */
function walkFiles(dir, filter, out) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      walkFiles(full, filter, out);
    } else if (entry.isFile() && filter(entry.name)) {
      out.push(full);
    }
  }
}

/**
 * @param {string} oldTag
 * @param {string} newTag
 * @returns {string[]} arquivos alterados
 */
function rewriteInternalActionTags(oldTag, newTag) {
  /** @type {string[]} */
  const targets = [];
  const rootAction = path.join(ROOT, 'action.yml');
  if (fs.existsSync(rootAction)) targets.push(rootAction);
  walkFiles(path.join(ROOT, 'internal'), (name) => name === 'action.yml', targets);
  walkFiles(path.join(ROOT, 'examples'), (name) => /\.ya?ml$/i.test(name), targets);

  const from = `@${oldTag}`;
  /** @type {string[]} */
  const changed = [];

  for (const file of targets) {
    const before = fs.readFileSync(file, 'utf8');
    if (!before.includes(INTERNAL_PREFIX.slice(0, -1))) continue;
    if (!before.includes(from)) continue;

    // Troca so refs deste owner/repo (evita comentario # vX.Y.Z de actions externas)
    const after = before.replace(
      new RegExp(`(JuanCunhaa/Afrika-Veracode-Build(?:/[^\\s@]+)?)@${oldTag.replace(/\./g, '\\.')}`, 'g'),
      `$1@${newTag}`
    );
    if (after === before) continue;
    fs.writeFileSync(file, after, 'utf8');
    changed.push(path.relative(ROOT, file).split(path.sep).join('/'));
  }

  return changed;
}

/**
 * @param {string} newVersion
 */
function updatePackageFiles(newVersion) {
  const pkgPath = path.join(ROOT, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.version = newVersion;
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

  const lockPath = path.join(ROOT, 'package-lock.json');
  if (fs.existsSync(lockPath)) {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    lock.version = newVersion;
    if (lock.packages && lock.packages['']) {
      lock.packages[''].version = newVersion;
    }
    fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`, 'utf8');
  }
}

async function main() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const current = String(pkg.version);
  const parts = parseSemver(current);

  const arg = process.argv[2];
  const kind = arg ? normalizeChoice(arg) : await askBumpKind();
  if (!kind) {
    console.error(`Argumento invalido: "${arg}". Use major|minor|patch (ou X|Y|Z).`);
    process.exit(1);
  }

  const next = bump(parts, kind);
  const oldTag = `v${current}`;
  const newTag = `v${next}`;

  console.log('');
  console.log(`Escolhido: ${EXPLAIN[kind].name}`);
  console.log(`  ${EXPLAIN[kind].meaning}`);
  console.log('');
  console.log(`Versao: ${current}  ->  ${next}   (tag ${oldTag} -> ${newTag})`);

  updatePackageFiles(next);
  const rewritten = rewriteInternalActionTags(oldTag, newTag);

  console.log('');
  console.log('Atualizado:');
  console.log('  - package.json');
  if (fs.existsSync(path.join(ROOT, 'package-lock.json'))) {
    console.log('  - package-lock.json');
  }
  for (const f of rewritten) {
    console.log(`  - ${f} (uses internos ${oldTag} -> ${newTag})`);
  }

  console.log('');
  console.log('Proximos passos:');
  console.log('  1. Atualize CHANGELOG.md com as mudancas desta versao.');
  console.log('  2. Commit na main (ou via PR).');
  console.log(`  3. O workflow Release na main cria o GitHub Release ${newTag} automaticamente.`);
  console.log('  4. Rode npm run pr para validar o pinning.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
