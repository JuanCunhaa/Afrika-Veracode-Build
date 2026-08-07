'use strict';

/**
 * Valida pinning de `uses` em workflows e composite actions.
 *
 * Delimitador interno vs externo:
 *   interno  = owner/repo deste projeto (INTERNAL_OWNER_REPO + "/")
 *   externo  = qualquer outro owner/repo
 *
 * Regras:
 *   - interno: ref = SHA 40 hex  OU  tag exata v{package.json version}
 *   - externo: ref = SHA 40 hex obrigatorio
 *   - uses: ./... so permitido em .github/ (workflows do proprio repo);
 *     proibido em action.yml / internal/** (composite publicada quebra no consumidor)
 *   - docker:// permitido
 *
 * Escopo: action.yml, internal/ (action.yml), .github/ (yml/yaml)
 *
 * Ao adicionar um uses novo:
 *   - sub-action deste repo  -> JuanCunhaa/Afrika-Veracode-Build/internal/...@vX.Y.Z
 *   - action de terceiro     -> owner/repo@sha40 com comentario # vX.Y.Z
 *   O prefixo INTERNAL_OWNER_REPO e o delimitador; nao inventar ./ nem outro owner.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');

/** Delimitador: tudo sob este owner/repo e action interna deste projeto. */
const INTERNAL_OWNER_REPO = 'JuanCunhaa/Afrika-Veracode-Build';

const FULL_SHA_RE = /^[0-9a-f]{40}$/i;
const USES_RE = /^\s*-?\s*uses:\s*(.+?)\s*$/;

/**
 * @returns {string} tag vX.Y.Z alinhada ao package.json
 */
function expectedInternalTag() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  return `v${pkg.version}`;
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
 * @returns {string[]}
 */
function collectTargets() {
  /** @type {string[]} */
  const files = [];
  const rootAction = path.join(ROOT, 'action.yml');
  if (fs.existsSync(rootAction)) files.push(rootAction);
  walkFiles(path.join(ROOT, '.github'), (name) => /\.ya?ml$/i.test(name), files);
  walkFiles(path.join(ROOT, 'internal'), (name) => name === 'action.yml', files);
  return files.sort();
}

/**
 * @param {string} filePath
 * @returns {boolean} true se o arquivo e workflow local (.github/), nao composite publicada
 */
function isWorkflowFile(filePath) {
  const rel = path.relative(ROOT, filePath).split(path.sep).join('/');
  return rel.startsWith('.github/');
}

/**
 * @param {string} usesValue
 * @returns {{ kind: 'docker' | 'local' | 'remote', action: string, ref: string | null } | null}
 */
function parseUses(usesValue) {
  const withoutComment = usesValue.replace(/\s+#.*$/, '').trim();
  const raw = withoutComment.replace(/^['"]|['"]$/g, '').trim();
  if (!raw) return null;

  if (raw.startsWith('docker://')) {
    return { kind: 'docker', action: raw, ref: null };
  }

  if (raw.startsWith('./') || raw.startsWith('.\\')) {
    return { kind: 'local', action: raw, ref: null };
  }

  const at = raw.lastIndexOf('@');
  if (at <= 0) {
    return { kind: 'remote', action: raw, ref: null };
  }

  return {
    kind: 'remote',
    action: raw.slice(0, at),
    ref: raw.slice(at + 1)
  };
}

/**
 * @param {string} action
 * @returns {boolean}
 */
function isInternalAction(action) {
  return action === INTERNAL_OWNER_REPO || action.startsWith(`${INTERNAL_OWNER_REPO}/`);
}

/**
 * @param {string} ref
 * @param {string} internalTag
 * @param {boolean} internal
 * @returns {boolean}
 */
function isAllowedRef(ref, internalTag, internal) {
  if (FULL_SHA_RE.test(ref)) return true;
  if (internal && ref === internalTag) return true;
  return false;
}

/**
 * @param {string} filePath
 * @param {string} internalTag
 * @returns {{ file: string, line: number, uses: string, reason: string }[]}
 */
function findViolations(filePath, internalTag) {
  const rel = path.relative(ROOT, filePath).split(path.sep).join('/');
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  /** @type {{ file: string, line: number, uses: string, reason: string }[]} */
  const violations = [];
  const inWorkflow = isWorkflowFile(filePath);

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(USES_RE);
    if (!match) continue;

    const parsed = parseUses(match[1]);
    if (!parsed) continue;

    const usesDisplay = match[1].trim();

    if (parsed.kind === 'docker') continue;

    if (parsed.kind === 'local') {
      // ./ so funciona no repo do workflow; em composite publicada resolve no consumidor
      if (!inWorkflow) {
        violations.push({
          file: rel,
          line: i + 1,
          uses: usesDisplay,
          reason: `uses: ./... proibido em composite publicada — use ${INTERNAL_OWNER_REPO}/<path>@${internalTag} (ou SHA)`
        });
      }
      continue;
    }

    // remote
    if (!parsed.ref) {
      violations.push({
        file: rel,
        line: i + 1,
        uses: usesDisplay,
        reason: 'ref ausente — interno: @' + internalTag + ' ou SHA; externo: SHA 40 hex'
      });
      continue;
    }

    // Expressoes GitHub (${{ }}) / shell (${VAR}) nao sao refs literais de pin
    if (/\$\{/.test(parsed.ref) || /\$\{/.test(parsed.action)) continue;

    const internal = isInternalAction(parsed.action);
    if (!isAllowedRef(parsed.ref, internalTag, internal)) {
      if (internal) {
        violations.push({
          file: rel,
          line: i + 1,
          uses: usesDisplay,
          reason: `interno: use @${internalTag} (package.json) ou SHA 40 hex — recebido @${parsed.ref}`
        });
      } else {
        violations.push({
          file: rel,
          line: i + 1,
          uses: usesDisplay,
          reason: `externo: obrigatorio SHA 40 hex — recebido @${parsed.ref}`
        });
      }
    }
  }

  return violations;
}

function main() {
  const internalTag = expectedInternalTag();
  const targets = collectTargets();
  /** @type {{ file: string, line: number, uses: string, reason: string }[]} */
  const all = [];

  for (const file of targets) {
    all.push(...findViolations(file, internalTag));
  }

  if (all.length === 0) {
    console.log(
      `check-action-pinning: ok (${targets.length} arquivo(s); interno=${INTERNAL_OWNER_REPO}@${internalTag}|sha; externo=sha40)`
    );
    process.exit(0);
  }

  console.error('check-action-pinning: falhou\n');
  console.error(`  Delimitador interno: ${INTERNAL_OWNER_REPO}/`);
  console.error(`  Tag interna esperada: @${internalTag} (de package.json)\n`);

  for (const v of all) {
    console.error(`  ${v.file}:${v.line}`);
    console.error(`    uses: ${v.uses}`);
    console.error(`    ${v.reason}\n`);
  }

  console.error(`Total: ${all.length} violacao(oes).`);
  process.exit(1);
}

main();
