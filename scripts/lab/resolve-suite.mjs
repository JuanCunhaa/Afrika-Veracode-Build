/**
 * Pure suite / skip resolver for Trusted Lab Orchestrator.
 * Compatibility Lab modes: pr | full only (Veracode E2E is separate).
 * Event→gate policy also lives in schemas/event-policy.json.
 *
 * @typedef {'pr'|'full'} LabSuite
 * @typedef {{ suite: LabSuite, skipReason: string|null, draft: boolean }} ResolveResult
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @returns {object}
 */
export function loadEventPolicy() {
  const p = path.resolve(__dirname, '../../schemas/event-policy.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/**
 * Map CI source event → event-policy key.
 * @param {object} input
 */
export function eventPolicyKey({ sourceEvent, headBranch = '', defaultBranch = 'main' } = {}) {
  const event = String(sourceEvent || '').trim();
  const branch = String(headBranch || '').trim();
  const def = String(defaultBranch || 'main').trim() || 'main';
  if (event === 'workflow_dispatch') return 'workflow_dispatch';
  if (event === 'merge_group') return 'merge_group';
  if (event === 'pull_request') return 'pull_request_to_main';
  if (event === 'push' && branch === def) return 'push_main';
  if (event === 'push') return 'push_non_main';
  if (event === 'release_candidate') return 'release_candidate';
  return 'push_non_main';
}

/**
 * @param {object} input
 * @param {string} input.sourceEvent
 * @param {string} [input.headBranch]
 * @param {string} [input.defaultBranch]
 * @param {boolean} [input.draft]
 * @param {string} [input.manualSuite]
 * @returns {ResolveResult}
 */
export function resolveLabSuite({
  sourceEvent,
  headBranch = '',
  defaultBranch = 'main',
  draft = false,
  manualSuite = ''
} = {}) {
  const event = String(sourceEvent || '').trim();
  const branch = String(headBranch || '').trim();
  const def = String(defaultBranch || 'main').trim() || 'main';

  if (event === 'workflow_dispatch') {
    const s = String(manualSuite || 'pr').trim();
    if (s !== 'pr' && s !== 'full') {
      throw new Error(`Invalid manual suite "${s}" — only pr|full allowed`);
    }
    return { suite: s, skipReason: null, draft: false };
  }

  if (event === 'pull_request' && draft === true) {
    return {
      suite: 'pr',
      skipReason: 'DRAFT_PR_LAB_DEFERRED',
      draft: true
    };
  }

  if (event === 'push' && branch === def) {
    return { suite: 'full', skipReason: null, draft: false };
  }

  return { suite: 'pr', skipReason: null, draft: Boolean(draft) };
}

/**
 * @param {string} repository
 * @param {string} sha
 * @param {string} suite
 */
export function labDedupeKey(repository, sha, suite) {
  return `${repository}:${sha}:${suite}`;
}
