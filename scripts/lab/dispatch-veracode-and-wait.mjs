#!/usr/bin/env node
/**
 * Dispatch Veracode Pipeline E2E on Lab and wait (trusted Action orchestrator).
 * Reuses App auth helpers from dispatch-and-wait.mjs.
 *
 * Env: LAB_GITHUB_APP_*, LAB_OWNER, LAB_REPO, LAB_REF,
 *      SOURCE_REPOSITORY, SOURCE_SHA, VERACODE_PROFILE (representative|full),
 *      CORRELATION_ID, POLL_INTERVAL_MS, TIMEOUT_MS, GITHUB_OUTPUT
 */

import process from 'node:process';
import {
  ERROR_CODES,
  createAppJwt,
  dispatchWorkflow,
  findRunByCorrelation,
  getInstallationToken,
  labError,
  waitForRun,
  writeGithubOutput,
  writeStepSummary
} from './dispatch-and-wait.mjs';

export async function main(env = process.env, deps = {}) {
  const fetchImpl = deps.fetchImpl || globalThis.fetch;
  const sleep = deps.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const now = deps.now || (() => Date.now());
  const log = deps.log || console;

  const apiUrl = env.GITHUB_API_URL || 'https://api.github.com';
  const owner = env.LAB_OWNER || 'JuanCunhaa';
  const repo = env.LAB_REPO || 'Afrika-Veracode-Build-Lab';
  const workflowFile = env.LAB_WORKFLOW_FILE || 'veracode-pipeline-e2e.yml';
  const ref = env.LAB_REF || 'main';
  const profile = env.VERACODE_PROFILE || 'representative';
  const correlationId = env.CORRELATION_ID || `veracode-${Date.now()}`;

  if (!['representative', 'full', 'none'].includes(profile)) {
    throw labError(
      ERROR_CODES.LAB_RESULT_INVALID,
      `VERACODE_PROFILE must be representative|full|none, got: ${profile}`
    );
  }
  if (profile === 'none') {
    writeGithubOutput(env.GITHUB_OUTPUT, {
      lab_run_id: '',
      lab_run_url: '',
      dedupe: 'skipped',
      profile: 'none',
      skipped: 'true'
    });
    return 0;
  }

  const sourceSha = env.SOURCE_SHA || '';
  if (!/^[0-9a-f]{40}$/.test(sourceSha)) {
    throw labError(ERROR_CODES.LAB_RESULT_INVALID, 'SOURCE_SHA must be 40 hex chars');
  }

  const inputs = {
    source_repository: env.SOURCE_REPOSITORY || 'JuanCunhaa/Afrika-Veracode-Build',
    source_sha: sourceSha,
    profile
  };

  const jwt = createAppJwt(env.LAB_GITHUB_APP_ID, env.LAB_GITHUB_APP_PRIVATE_KEY);
  const { token } = await getInstallationToken({
    apiUrl,
    jwt,
    owner,
    repo,
    installationId: env.LAB_GITHUB_APP_INSTALLATION_ID,
    fetchImpl
  });

  const { runId: dispatchedRunId, dispatchedAt } = await dispatchWorkflow({
    apiUrl,
    token,
    owner,
    repo,
    workflowFile,
    ref,
    inputs,
    fetchImpl
  });

  let runId = dispatchedRunId;
  if (runId == null) {
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
  }

  const pollIntervalMs = Number(env.POLL_INTERVAL_MS || 20_000);
  const timeoutMs = Number(env.TIMEOUT_MS || 7_200_000);

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
    dedupe: 'dispatched',
    profile,
    skipped: 'false'
  });
  return 0;
}

function isCli() {
  const entry = process.argv[1];
  if (!entry) return false;
  return entry.replace(/\\/g, '/').endsWith('scripts/lab/dispatch-veracode-and-wait.mjs');
}

if (isCli()) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      const code = err && err.code ? err.code : ERROR_CODES.LAB_RESULT_INVALID;
      const msg = err && err.message ? err.message : String(err);
      console.error(`::error title=${code}::${msg}`);
      process.exit(1);
    }
  );
}
