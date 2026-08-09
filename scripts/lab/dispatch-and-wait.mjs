/**
 * Trusted Lab orchestrator helper: GitHub App JWT → installation token →
 * workflow_dispatch on Afrika-Veracode-Build-Lab → poll until completed.
 *
 * Primary path: POST .../dispatches with return_run_details:true → workflow_run_id.
 * Fallback ONLY when no run id: search runs by event=workflow_dispatch + correlation_id
 * in display_title/name (LAB_RUN_LOOKUP_FALLBACK).
 *
 * Deduplication: before dispatch, reuse a Lab Gate run for the same
 * source_sha + suite when status is queued/in_progress or conclusion=success.
 *
 * NEVER log private key, installation token, or Authorization header.
 *
 * CLI: node scripts/lab/dispatch-and-wait.mjs
 * Env: LAB_GITHUB_APP_ID, LAB_GITHUB_APP_PRIVATE_KEY, LAB_GITHUB_APP_INSTALLATION_ID?,
 *      LAB_OWNER, LAB_REPO, LAB_WORKFLOW_FILE, LAB_REF, SOURCE_*, SUITE, CORRELATION_ID,
 *      POLL_INTERVAL_MS, TIMEOUT_MS, GITHUB_API_URL, GITHUB_OUTPUT
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import process from 'node:process';
import { labDedupeKey } from './resolve-suite.mjs';

export const ERROR_CODES = Object.freeze({
  LAB_AUTH_FAILED: 'LAB_AUTH_FAILED',
  LAB_DISPATCH_FAILED: 'LAB_DISPATCH_FAILED',
  LAB_RUN_NOT_FOUND: 'LAB_RUN_NOT_FOUND',
  LAB_RUN_TIMEOUT: 'LAB_RUN_TIMEOUT',
  LAB_RUN_FAILED: 'LAB_RUN_FAILED',
  LAB_RUN_CANCELLED: 'LAB_RUN_CANCELLED',
  LAB_RESULT_INVALID: 'LAB_RESULT_INVALID'
});

/**
 * @param {string} code
 * @param {string} message
 * @returns {Error & { code: string }}
 */
export function labError(code, message) {
  const err = new Error(`${code}: ${message}`);
  err.code = code;
  return err;
}

/**
 * @param {string} pem
 * @returns {string}
 */
export function normalizePrivateKey(pem) {
  if (!pem || typeof pem !== 'string') {
    throw labError(ERROR_CODES.LAB_AUTH_FAILED, 'LAB_GITHUB_APP_PRIVATE_KEY is missing');
  }
  let key = pem.trim();
  if (key.includes('\\n')) {
    key = key.replace(/\\n/g, '\n');
  }
  if (!key.includes('BEGIN')) {
    throw labError(ERROR_CODES.LAB_AUTH_FAILED, 'LAB_GITHUB_APP_PRIVATE_KEY is not a PEM key');
  }
  return key;
}

/**
 * @param {object} obj
 * @returns {string}
 */
function b64urlJson(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Create a GitHub App JWT (RS256) with crypto.createSign.
 * @param {string|number} appId
 * @param {string} privateKeyPem
 * @param {number} [nowSec]
 * @returns {string}
 */
export function createAppJwt(appId, privateKeyPem, nowSec = Math.floor(Date.now() / 1000)) {
  const key = normalizePrivateKey(privateKeyPem);
  const iss = String(appId || '').trim();
  if (!iss) {
    throw labError(ERROR_CODES.LAB_AUTH_FAILED, 'LAB_GITHUB_APP_ID is missing');
  }
  const header = { alg: 'RS256', typ: 'JWT' };
  // GitHub allows iat up to 60s in the past to account for clock skew.
  const payload = {
    iat: nowSec - 60,
    exp: nowSec + 9 * 60,
    iss
  };
  const unsigned = `${b64urlJson(header)}.${b64urlJson(payload)}`;
  let signer;
  try {
    signer = crypto.createSign('RSA-SHA256');
    signer.update(unsigned);
    signer.end();
  } catch {
    throw labError(ERROR_CODES.LAB_AUTH_FAILED, 'Failed to initialize JWT signer');
  }
  let sig;
  try {
    sig = signer.sign(key);
  } catch {
    throw labError(ERROR_CODES.LAB_AUTH_FAILED, 'Failed to sign GitHub App JWT (invalid key?)');
  }
  const sigB64 = Buffer.from(sig).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${unsigned}.${sigB64}`;
}

/**
 * @param {string} apiUrl
 * @param {string} path
 * @param {object} opts
 * @param {typeof fetch} [fetchImpl]
 */
async function ghFetch(apiUrl, path, opts, fetchImpl = globalThis.fetch) {
  const url = `${apiUrl.replace(/\/$/, '')}${path}`;
  const res = await fetchImpl(url, opts);
  return res;
}

/**
 * Resolve installation id then mint an installation access token.
 * Never logs token or Authorization.
 *
 * @param {object} params
 * @param {string} params.apiUrl
 * @param {string} params.jwt
 * @param {string} params.owner
 * @param {string} params.repo
 * @param {string} [params.installationId]
 * @param {typeof fetch} [params.fetchImpl]
 * @returns {Promise<{ token: string, installationId: string }>}
 */
export async function getInstallationToken({ apiUrl, jwt, owner, repo, installationId, fetchImpl = globalThis.fetch }) {
  let id = installationId ? String(installationId).trim() : '';
  const authHeaders = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${jwt}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'Afrika-Veracode-Build-lab-orchestrator'
  };

  if (!id) {
    const instRes = await ghFetch(
      apiUrl,
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/installation`,
      { method: 'GET', headers: authHeaders },
      fetchImpl
    );
    if (!instRes.ok) {
      throw labError(
        ERROR_CODES.LAB_AUTH_FAILED,
        `Failed to resolve installation for ${owner}/${repo} (HTTP ${instRes.status})`
      );
    }
    const instBody = await instRes.json();
    id = String(instBody.id || '');
    if (!id) {
      throw labError(ERROR_CODES.LAB_AUTH_FAILED, 'Installation id missing in API response');
    }
  }

  const tokenRes = await ghFetch(
    apiUrl,
    `/app/installations/${encodeURIComponent(id)}/access_tokens`,
    {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    },
    fetchImpl
  );
  if (!tokenRes.ok) {
    throw labError(ERROR_CODES.LAB_AUTH_FAILED, `Failed to mint installation token (HTTP ${tokenRes.status})`);
  }
  const tokenBody = await tokenRes.json();
  const token = tokenBody.token;
  if (!token || typeof token !== 'string') {
    throw labError(ERROR_CODES.LAB_AUTH_FAILED, 'Installation token missing in API response');
  }
  return { token, installationId: id };
}

/**
 * @param {object} params
 * @returns {Promise<{ runId: number|null, dispatchedAt: string }>}
 */
export async function dispatchWorkflow({
  apiUrl,
  token,
  owner,
  repo,
  workflowFile,
  ref,
  inputs,
  fetchImpl = globalThis.fetch
}) {
  const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`;
  const body = {
    ref,
    return_run_details: true,
    inputs: Object.fromEntries(Object.entries(inputs || {}).map(([k, v]) => [k, v == null ? '' : String(v)]))
  };
  const dispatchedAt = new Date().toISOString();
  const res = await ghFetch(
    apiUrl,
    path,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Afrika-Veracode-Build-lab-orchestrator',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    },
    fetchImpl
  );

  // Prefer 200 with workflow_run_id (return_run_details). Classic API returns 204.
  if (res.status === 204) {
    return { runId: null, dispatchedAt };
  }
  if (!res.ok) {
    throw labError(
      ERROR_CODES.LAB_DISPATCH_FAILED,
      `workflow_dispatch failed (HTTP ${res.status}) for ${owner}/${repo}/${workflowFile}`
    );
  }

  let runId = null;
  try {
    const json = await res.json();
    const raw = json.workflow_run_id ?? json.workflow_run?.id ?? json.id ?? null;
    if (raw != null) {
      runId = Number(raw);
      if (!Number.isFinite(runId)) runId = null;
    }
  } catch {
    // 200 with empty/non-JSON body → fallback lookup
    runId = null;
  }
  return { runId, dispatchedAt };
}

/**
 * Match Lab Gate run-name / display_title for SHA + suite dedupe.
 * Lab run-name: Lab Gate | ${suite} | ${source_sha} | ${correlation_id}
 *
 * @param {object} run
 * @param {string} sourceSha
 * @param {string} suite
 * @returns {boolean}
 */
export function runMatchesShaSuite(run, sourceSha, suite) {
  const sha = String(sourceSha || '');
  const s = String(suite || '');
  if (!sha || !s) return false;
  const title = `${run.display_title || ''} ${run.name || ''}`;
  // Require both suite token and full sha in the title (run-name format).
  const suiteMarker = `| ${s} |`;
  return title.includes(suiteMarker) && title.includes(sha);
}

/**
 * Find an existing Lab Gate run for the same repository + exact SHA + suite.
 * Feature-push HEAD and PR merge SHA must not match across events — no cross-dedupe.
 * Prefer in-flight (queued/in_progress), else successful completed.
 * Failure/cancelled are NOT reused (allow redispatch).
 *
 * @param {object} params
 * @returns {Promise<{ runId: number, htmlUrl: string, mode: 'in_flight'|'success' }|null>}
 */
export async function findExistingLabRun({
  apiUrl,
  token,
  owner,
  repo,
  sourceSha,
  suite,
  fetchImpl = globalThis.fetch,
  log = console
}) {
  const path =
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs` +
    `?event=workflow_dispatch&per_page=50`;
  const res = await ghFetch(
    apiUrl,
    path,
    {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Afrika-Veracode-Build-lab-orchestrator'
      }
    },
    fetchImpl
  );
  if (!res.ok) {
    log.info
      ? log.info(`LAB_DEDUPE_LOOKUP_SKIP HTTP ${res.status}`)
      : console.log(`LAB_DEDUPE_LOOKUP_SKIP HTTP ${res.status}`);
    return null;
  }
  const body = await res.json();
  const runs = Array.isArray(body.workflow_runs) ? body.workflow_runs : [];
  const matches = runs.filter((r) => runMatchesShaSuite(r, sourceSha, suite));
  if (matches.length === 0) return null;

  matches.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const inFlight = matches.find((r) => r.status === 'queued' || r.status === 'in_progress');
  if (inFlight) {
    return {
      runId: Number(inFlight.id),
      htmlUrl: String(inFlight.html_url || ''),
      mode: 'in_flight'
    };
  }

  const success = matches.find((r) => r.status === 'completed' && r.conclusion === 'success');
  if (success) {
    return {
      runId: Number(success.id),
      htmlUrl: String(success.html_url || ''),
      mode: 'success'
    };
  }

  return null;
}

/**
 * Write GitHub Actions step outputs (lab_run_id, lab_run_url, dedupe).
 * @param {string|undefined} outputPath
 * @param {Record<string, string|number>} values
 */
export function writeGithubOutput(outputPath, values) {
  if (!outputPath) return;
  const lines = Object.entries(values).map(([k, v]) => `${k}=${v}`);
  fs.appendFileSync(outputPath, `${lines.join('\n')}\n`);
}

/**
 * Fallback when return_run_details did not yield workflow_run_id.
 * Search workflow_dispatch runs created after dispatch, match correlation_id in
 * display_title or name.
 *
 * @param {object} params
 * @returns {Promise<number>}
 */
export async function findRunByCorrelation({
  apiUrl,
  token,
  owner,
  repo,
  correlationId,
  dispatchedAt,
  fetchImpl = globalThis.fetch,
  log = console
}) {
  const corr = String(correlationId || '');
  if (!corr) {
    throw labError(ERROR_CODES.LAB_RUN_NOT_FOUND, 'correlation_id required for fallback lookup');
  }
  log.info
    ? log.info(`LAB_RUN_LOOKUP_FALLBACK correlation_id=${corr}`)
    : console.log(`LAB_RUN_LOOKUP_FALLBACK correlation_id=${corr}`);

  const createdAfter = new Date(dispatchedAt).getTime() - 60_000;
  const path =
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs` +
    `?event=workflow_dispatch&per_page=30`;
  const res = await ghFetch(
    apiUrl,
    path,
    {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Afrika-Veracode-Build-lab-orchestrator'
      }
    },
    fetchImpl
  );
  if (!res.ok) {
    throw labError(
      ERROR_CODES.LAB_RUN_NOT_FOUND,
      `Failed to list workflow runs for correlation fallback (HTTP ${res.status})`
    );
  }
  const body = await res.json();
  const runs = Array.isArray(body.workflow_runs) ? body.workflow_runs : [];
  const matches = runs.filter((r) => {
    const created = new Date(r.created_at).getTime();
    if (Number.isFinite(createdAfter) && created < createdAfter) return false;
    const title = `${r.display_title || ''} ${r.name || ''}`;
    return title.includes(corr);
  });
  if (matches.length === 0) {
    throw labError(ERROR_CODES.LAB_RUN_NOT_FOUND, `No workflow_dispatch run matched correlation_id=${corr}`);
  }
  // Prefer newest match
  matches.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return Number(matches[0].id);
}

/**
 * @param {object} run
 * @returns {'success'|'failure'|'cancelled'|'timed_out'|'action_required'|'stale'|'pending'|'unknown'}
 */
export function classifyConclusion(run) {
  if (!run || run.status !== 'completed') return 'pending';
  switch (run.conclusion) {
    case 'success':
      return 'success';
    case 'cancelled':
      return 'cancelled';
    case 'timed_out':
      return 'timed_out';
    case 'action_required':
      return 'action_required';
    case 'stale':
      return 'stale';
    case 'failure':
    case 'neutral':
    case 'skipped':
      return 'failure';
    default:
      return 'unknown';
  }
}

/**
 * Poll GET /repos/.../actions/runs/{id} until completed or timeout.
 *
 * @param {object} params
 * @returns {Promise<{ run: object, jobs: object[] }>}
 */
export async function waitForRun({
  apiUrl,
  token,
  owner,
  repo,
  runId,
  pollIntervalMs = 15_000,
  timeoutMs = 3_600_000,
  fetchImpl = globalThis.fetch,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  now = () => Date.now(),
  log = console
}) {
  const id = Number(runId);
  if (!Number.isFinite(id)) {
    throw labError(ERROR_CODES.LAB_RESULT_INVALID, 'runId must be a number');
  }
  const deadline = now() + timeoutMs;
  let run;

  while (now() < deadline) {
    const res = await ghFetch(
      apiUrl,
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs/${id}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'Afrika-Veracode-Build-lab-orchestrator'
        }
      },
      fetchImpl
    );
    if (res.status === 404) {
      throw labError(ERROR_CODES.LAB_RUN_NOT_FOUND, `Workflow run ${id} not found`);
    }
    if (!res.ok) {
      throw labError(ERROR_CODES.LAB_RESULT_INVALID, `Failed to fetch workflow run ${id} (HTTP ${res.status})`);
    }
    run = await res.json();
    if (Number(run.id) !== id) {
      throw labError(ERROR_CODES.LAB_RESULT_INVALID, `API returned unexpected run id (expected ${id})`);
    }
    log.info
      ? log.info(`Lab run ${id} status=${run.status} conclusion=${run.conclusion || '-'}`)
      : console.log(`Lab run ${id} status=${run.status} conclusion=${run.conclusion || '-'}`);

    if (run.status === 'completed') break;
    await sleep(pollIntervalMs);
  }

  if (!run || run.status !== 'completed') {
    throw labError(ERROR_CODES.LAB_RUN_TIMEOUT, `Lab workflow run ${id} did not complete within ${timeoutMs}ms`);
  }

  const kind = classifyConclusion(run);
  if (kind === 'cancelled') {
    throw labError(ERROR_CODES.LAB_RUN_CANCELLED, `Lab workflow run ${id} was cancelled`);
  }
  if (kind === 'timed_out' || kind === 'action_required' || kind === 'stale') {
    throw labError(ERROR_CODES.LAB_RUN_FAILED, `Lab workflow run ${id} ended with conclusion=${run.conclusion}`);
  }
  if (kind !== 'success') {
    throw labError(ERROR_CODES.LAB_RUN_FAILED, `Lab workflow run ${id} failed with conclusion=${run.conclusion}`);
  }

  let jobs = [];
  try {
    const jobsRes = await ghFetch(
      apiUrl,
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs/${id}/jobs?per_page=100`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'Afrika-Veracode-Build-lab-orchestrator'
        }
      },
      fetchImpl
    );
    if (jobsRes.ok) {
      const jobsBody = await jobsRes.json();
      jobs = Array.isArray(jobsBody.jobs) ? jobsBody.jobs : [];
    }
  } catch {
    jobs = [];
  }

  return { run, jobs };
}

/**
 * @param {object} run
 * @param {object[]} jobs
 * @param {string} [summaryPath]
 */
export function writeStepSummary(run, jobs, summaryPath = process.env.GITHUB_STEP_SUMMARY) {
  if (!summaryPath) return;
  const lines = [
    '## Lab Compatibility Gate',
    '',
    `| Field | Value |`,
    `| --- | --- |`,
    `| Run id | ${run.id} |`,
    `| Status | ${run.status} |`,
    `| Conclusion | ${run.conclusion} |`,
    `| HTML URL | ${run.html_url || ''} |`,
    `| Display title | ${run.display_title || run.name || ''} |`,
    '',
    '### Jobs',
    '',
    '| Job | Conclusion |',
    '| --- | --- |'
  ];
  for (const j of jobs) {
    lines.push(`| ${j.name} | ${j.conclusion || j.status} |`);
  }
  lines.push('');
  fs.appendFileSync(summaryPath, `${lines.join('\n')}\n`);
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @param {object} [deps]
 * @returns {Promise<number>} exit code
 */
export async function main(env = process.env, deps = {}) {
  const fetchImpl = deps.fetchImpl || globalThis.fetch;
  const sleep = deps.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const now = deps.now || (() => Date.now());
  const log = deps.log || console;

  const apiUrl = env.GITHUB_API_URL || 'https://api.github.com';
  const owner = env.LAB_OWNER || 'JuanCunhaa';
  const repo = env.LAB_REPO || 'Afrika-Veracode-Build-Lab';
  const workflowFile = env.LAB_WORKFLOW_FILE || 'lab-gate.yml';
  const ref = env.LAB_REF || 'main';
  const suite = env.SUITE || 'pr';
  const correlationId = env.CORRELATION_ID || '';
  const pollIntervalMs = Number(env.POLL_INTERVAL_MS || 15_000);
  const timeoutMs = Number(env.TIMEOUT_MS || 3_600_000);

  if (!correlationId) {
    throw labError(ERROR_CODES.LAB_RESULT_INVALID, 'CORRELATION_ID is required');
  }

  const sourceInputs = {
    source_repository: env.SOURCE_REPOSITORY || '',
    source_sha: env.SOURCE_SHA || '',
    source_ref: env.SOURCE_REF || '',
    source_event: env.SOURCE_EVENT || '',
    source_run_id: env.SOURCE_RUN_ID || '',
    source_run_attempt: env.SOURCE_RUN_ATTEMPT || '',
    source_pr_number: env.SOURCE_PR_NUMBER || '',
    suite,
    correlation_id: correlationId
  };

  if (!['pr', 'full'].includes(suite)) {
    throw labError(ERROR_CODES.LAB_RESULT_INVALID, `SUITE must be pr|full, got: ${suite}`);
  }

  const jwt = createAppJwt(env.LAB_GITHUB_APP_ID, env.LAB_GITHUB_APP_PRIVATE_KEY);
  const { token } = await getInstallationToken({
    apiUrl,
    jwt,
    owner,
    repo,
    installationId: env.LAB_GITHUB_APP_INSTALLATION_ID,
    fetchImpl
  });

  const sourceSha = sourceInputs.source_sha;
  const dedupeLabel = labDedupeKey(sourceInputs.source_repository || `${owner}-action`, sourceSha, suite);
  let dedupeMode = 'dispatched';
  let runId = null;

  const existing = await findExistingLabRun({
    apiUrl,
    token,
    owner,
    repo,
    sourceSha,
    suite,
    fetchImpl,
    log
  });

  if (existing) {
    runId = existing.runId;
    dedupeMode = 'reused';
    log.info
      ? log.info(`LAB_DEDUPE_REUSE key=${dedupeLabel} runId=${runId} mode=${existing.mode}`)
      : console.log(`LAB_DEDUPE_REUSE key=${dedupeLabel} runId=${runId} mode=${existing.mode}`);
  } else {
    const { runId: dispatchedRunId, dispatchedAt } = await dispatchWorkflow({
      apiUrl,
      token,
      owner,
      repo,
      workflowFile,
      ref,
      inputs: sourceInputs,
      fetchImpl
    });

    runId = dispatchedRunId;
    if (runId == null) {
      // Fallback ONLY if return_run_details did not provide workflow_run_id.
      runId = await findRunByCorrelation({
        apiUrl,
        token,
        owner,
        repo,
        correlationId,
        dispatchedAt,
        fetchImpl,
        log
      });
    } else {
      log.info
        ? log.info(`Dispatched Lab run id=${runId} (return_run_details)`)
        : console.log(`Dispatched Lab run id=${runId} (return_run_details)`);
    }
  }

  const { run, jobs } = await waitForRun({
    apiUrl,
    token,
    owner,
    repo,
    runId,
    pollIntervalMs,
    timeoutMs,
    fetchImpl,
    sleep,
    now,
    log
  });

  writeStepSummary(run, jobs, env.GITHUB_STEP_SUMMARY);
  writeGithubOutput(env.GITHUB_OUTPUT, {
    lab_run_id: run.id,
    lab_run_url: run.html_url || '',
    dedupe: dedupeMode,
    suite
  });
  return 0;
}

function isCli() {
  const entry = process.argv[1];
  if (!entry) return false;
  return entry.replace(/\\/g, '/').endsWith('scripts/lab/dispatch-and-wait.mjs');
}

if (isCli()) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      const code = err && err.code ? err.code : ERROR_CODES.LAB_RESULT_INVALID;
      const msg = err && err.message ? err.message : String(err);
      // Never echo secrets — message builders already omit key/token.
      console.error(`::error title=${code}::${msg}`);
      process.exit(1);
    }
  );
}
