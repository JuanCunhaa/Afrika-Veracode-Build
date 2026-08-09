import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Resolve which Action commit SHA Local Gate / Lab Compatibility Gate must use
 * so checks align with GitHub Branch Protection expectations.
 *
 * Policy:
 *   feature push     → branch HEAD SHA (workflow_run.head_sha)
 *   pull_request     → synthetic PR merge commit (refs/pull/<n>/merge)
 *   merge_group      → merge group SHA
 *   push main        → main HEAD SHA
 *   workflow_dispatch→ caller-supplied SHA
 *
 * Feature-push HEAD and PR merge SHA are intentionally different — do not
 * treat them as dedupe candidates across events.
 *
 * @typedef {'feature_head'|'pr_merge'|'merge_group'|'main_head'|'manual'|'ci_head'} ShaKind
 */

/**
 * @param {object} input
 * @param {string} input.sourceEvent
 * @param {string} [input.headSha] - workflow_run.head_sha / push tip
 * @param {string} [input.prMergeSha] - resolved refs/pull/<n>/merge object.sha
 * @param {string} [input.mergeGroupSha] - merge_group SHA (usually same as headSha)
 * @param {string} [input.headBranch]
 * @param {string} [input.defaultBranch]
 * @param {string} [input.manualSha]
 * @returns {{ sha: string, kind: ShaKind, note: string }}
 */
export function resolveSourceSha({
  sourceEvent,
  headSha = '',
  prMergeSha = '',
  mergeGroupSha = '',
  headBranch = '',
  defaultBranch = 'main',
  manualSha = ''
} = {}) {
  const event = String(sourceEvent || '').trim();
  const head = normalizeSha(headSha);
  const merge = normalizeSha(prMergeSha);
  const mg = normalizeSha(mergeGroupSha) || head;
  const branch = String(headBranch || '').trim();
  const def = String(defaultBranch || 'main').trim() || 'main';

  if (event === 'workflow_dispatch') {
    const sha = normalizeSha(manualSha) || head;
    if (!sha) throw new Error('workflow_dispatch requires source_sha');
    return { sha, kind: 'manual', note: 'Caller-supplied SHA for trusted re-run' };
  }

  if (event === 'pull_request') {
    if (!merge) {
      throw new Error(
        'pull_request requires refs/pull/<n>/merge SHA (PR merge commit), not only pull_request.head.sha'
      );
    }
    return {
      sha: merge,
      kind: 'pr_merge',
      note: 'Synthetic PR merge commit (refs/pull/<n>/merge) — matches Local Gate github.sha'
    };
  }

  if (event === 'merge_group') {
    if (!mg) throw new Error('merge_group requires merge group SHA');
    return { sha: mg, kind: 'merge_group', note: 'Merge queue group SHA' };
  }

  if (event === 'push') {
    if (!head) throw new Error('push requires head SHA');
    if (branch === def) {
      return { sha: head, kind: 'main_head', note: 'Default-branch push SHA' };
    }
    return { sha: head, kind: 'feature_head', note: 'Feature branch HEAD SHA' };
  }

  // Other CI events: fall back to workflow head (document if extended).
  if (!head) throw new Error(`Unable to resolve SHA for event=${event || '(empty)'}`);
  return { sha: head, kind: 'ci_head', note: `Fallback head SHA for event=${event}` };
}

/**
 * @param {string} sha
 * @returns {string}
 */
export function normalizeSha(sha) {
  const s = String(sha || '')
    .trim()
    .toLowerCase();
  if (!s) return '';
  if (!/^[0-9a-f]{40}$/.test(s)) return '';
  return s;
}

/**
 * True when two SHAs are identical 40-hex values (dedupe-eligible together with suite).
 * @param {string} a
 * @param {string} b
 */
export function isSameExactSha(a, b) {
  const x = normalizeSha(a);
  const y = normalizeSha(b);
  return Boolean(x && y && x === y);
}

/**
 * CLI for trusted orchestrator shells (avoids YAML-breaking inline heredocs).
 * Env: SOURCE_EVENT, HEAD_SHA, PR_MERGE_SHA, MERGE_GROUP_SHA, HEAD_BRANCH, DEFAULT_BRANCH, MANUAL_SHA
 * Prints three lines: sha, kind, note
 */
export function runResolveSourceShaCli(env = process.env) {
  const r = resolveSourceSha({
    sourceEvent: env.SOURCE_EVENT || '',
    headSha: env.HEAD_SHA || '',
    prMergeSha: env.PR_MERGE_SHA || '',
    mergeGroupSha: env.MERGE_GROUP_SHA || env.HEAD_SHA || '',
    headBranch: env.HEAD_BRANCH || '',
    defaultBranch: env.DEFAULT_BRANCH || 'main',
    manualSha: env.MANUAL_SHA || ''
  });
  process.stdout.write(`${r.sha}\n${r.kind}\n${r.note}\n`);
  return r;
}

const thisFile = fileURLToPath(import.meta.url);
const entry = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (entry && path.resolve(thisFile) === entry) {
  try {
    runResolveSourceShaCli();
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
