/**
 * Pure suite / skip resolver for Trusted Lab Orchestrator.
 * Compatibility Lab modes: pr | full only (Veracode E2E is separate).
 *
 * @typedef {'pr'|'full'} LabSuite
 * @typedef {{ suite: LabSuite, skipReason: string|null, draft: boolean }} ResolveResult
 */

/**
 * @param {object} input
 * @param {string} input.sourceEvent - originating CI event (push, pull_request, merge_group, workflow_dispatch, …)
 * @param {string} [input.headBranch]
 * @param {string} [input.defaultBranch]
 * @param {boolean} [input.draft] - PR is draft
 * @param {string} [input.manualSuite] - workflow_dispatch suite choice
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

  // Draft PRs: Local Gate only; Lab deferred until ready_for_review.
  if (event === 'pull_request' && draft === true) {
    return {
      suite: 'pr',
      skipReason: 'DRAFT_PR_LAB_DEFERRED',
      draft: true
    };
  }

  // Push to default branch → full compatibility.
  if (event === 'push' && branch === def) {
    return { suite: 'full', skipReason: null, draft: false };
  }

  // Feature push, PR, merge_group, and any other CI-success path → pr.
  return { suite: 'pr', skipReason: null, draft: Boolean(draft) };
}

/**
 * Deduplication key: repository:sha:suite
 * @param {string} repository
 * @param {string} sha
 * @param {string} suite
 */
export function labDedupeKey(repository, sha, suite) {
  return `${repository}:${sha}:${suite}`;
}
