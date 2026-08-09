'use strict';

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODULE_PATH = path.resolve(__dirname, '../../../scripts/lab/dispatch-and-wait.mjs');
const RESOLVE_PATH = path.resolve(__dirname, '../../../scripts/lab/resolve-suite.mjs');
const SHA_PATH = path.resolve(__dirname, '../../../scripts/lab/resolve-source-sha.mjs');

/** @type {typeof import('../../../scripts/lab/dispatch-and-wait.mjs')} */
let lab;
/** @type {typeof import('../../../scripts/lab/resolve-suite.mjs')} */
let resolveSuite;
/** @type {typeof import('../../../scripts/lab/resolve-source-sha.mjs')} */
let resolveSha;

/** Distinct fake private-key material that must NEVER appear in errors/logs. */
const FAKE_PRIVATE_KEY_MATERIAL = 'FAKE_PRIVATE_KEY_MATERIAL_DO_NOT_LEAK_abc123XYZ';

function generatePem() {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  return privateKey.export({ type: 'pkcs8', format: 'pem' });
}

/**
 * @param {Array<{ match: Function, status?: number, json?: any, text?: string }>} handlers
 */
function mockFetch(handlers) {
  /** @type {string[]} */
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push(`${init.method || 'GET'} ${url}`);
    const auth = init.headers && (init.headers.Authorization || init.headers.authorization);
    if (auth && String(auth).includes(FAKE_PRIVATE_KEY_MATERIAL)) {
      throw new Error('test invariant: Authorization must not contain private key material');
    }
    for (const h of handlers) {
      if (h.match(String(url), init)) {
        let resolved;
        const resolveJson = () => {
          if (resolved !== undefined) return resolved;
          if (h.json === null) {
            resolved = null;
            return null;
          }
          resolved = typeof h.json === 'function' ? h.json() : h.json;
          return resolved;
        };
        return {
          ok: (h.status ?? 200) >= 200 && (h.status ?? 200) < 300,
          status: h.status ?? 200,
          async json() {
            const val = resolveJson();
            if (val === null) throw new Error('no json');
            return val ?? {};
          },
          async text() {
            return h.text ?? JSON.stringify(resolveJson() ?? {});
          }
        };
      }
    }
    throw new Error(`Unexpected fetch: ${init.method || 'GET'} ${url}`);
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

function emptyDedupeList() {
  return {
    match: (u, i) => (i.method || 'GET') === 'GET' && u.includes('/actions/runs?event=workflow_dispatch'),
    json: { workflow_runs: [] }
  };
}

before(async () => {
  lab = await import(pathToFileURL(MODULE_PATH).href);
  resolveSuite = await import(pathToFileURL(RESOLVE_PATH).href);
  resolveSha = await import(pathToFileURL(SHA_PATH).href);
});

describe('resolveSourceSha (branch protection alignment)', () => {
  const head = 'a'.repeat(40);
  const merge = 'b'.repeat(40);
  const mainTip = 'c'.repeat(40);

  it('feature push uses branch HEAD (not a PR merge SHA)', () => {
    const r = resolveSha.resolveSourceSha({
      sourceEvent: 'push',
      headSha: head,
      headBranch: 'feature/x',
      defaultBranch: 'main'
    });
    assert.equal(r.sha, head);
    assert.equal(r.kind, 'feature_head');
  });

  it('pull_request requires and uses refs/pull/n/merge SHA', () => {
    const r = resolveSha.resolveSourceSha({
      sourceEvent: 'pull_request',
      headSha: head,
      prMergeSha: merge
    });
    assert.equal(r.sha, merge);
    assert.equal(r.kind, 'pr_merge');
    assert.notEqual(r.sha, head);
  });

  it('pull_request without merge SHA throws (prevents head.sha-only regression)', () => {
    assert.throws(() =>
      resolveSha.resolveSourceSha({
        sourceEvent: 'pull_request',
        headSha: head,
        prMergeSha: ''
      })
    );
  });

  it('merge_group uses merge group SHA', () => {
    const r = resolveSha.resolveSourceSha({
      sourceEvent: 'merge_group',
      headSha: head,
      mergeGroupSha: head
    });
    assert.equal(r.sha, head);
    assert.equal(r.kind, 'merge_group');
  });

  it('push main uses main tip → full path SHA', () => {
    const r = resolveSha.resolveSourceSha({
      sourceEvent: 'push',
      headSha: mainTip,
      headBranch: 'main',
      defaultBranch: 'main'
    });
    assert.equal(r.sha, mainTip);
    assert.equal(r.kind, 'main_head');
  });

  it('feature HEAD and PR merge SHA are not the same for dedupe', () => {
    assert.equal(resolveSha.isSameExactSha(head, merge), false);
    assert.equal(resolveSha.isSameExactSha(head, head), true);
  });
});

describe('resolveLabSuite', () => {
  it('maps events to pr|full and draft skip', () => {
    assert.deepEqual(
      resolveSuite.resolveLabSuite({
        sourceEvent: 'push',
        headBranch: 'feature/x',
        defaultBranch: 'main'
      }),
      { suite: 'pr', skipReason: null, draft: false }
    );
    assert.deepEqual(
      resolveSuite.resolveLabSuite({
        sourceEvent: 'pull_request',
        headBranch: 'feature/x',
        defaultBranch: 'main'
      }),
      { suite: 'pr', skipReason: null, draft: false }
    );
    assert.deepEqual(
      resolveSuite.resolveLabSuite({
        sourceEvent: 'merge_group',
        headBranch: 'gh-readonly-queue/main/pr-1',
        defaultBranch: 'main'
      }),
      { suite: 'pr', skipReason: null, draft: false }
    );
    assert.deepEqual(
      resolveSuite.resolveLabSuite({
        sourceEvent: 'push',
        headBranch: 'main',
        defaultBranch: 'main'
      }),
      { suite: 'full', skipReason: null, draft: false }
    );
    assert.deepEqual(
      resolveSuite.resolveLabSuite({
        sourceEvent: 'pull_request',
        draft: true,
        defaultBranch: 'main'
      }),
      { suite: 'pr', skipReason: 'DRAFT_PR_LAB_DEFERRED', draft: true }
    );
    assert.deepEqual(resolveSuite.resolveLabSuite({ sourceEvent: 'workflow_dispatch', manualSuite: 'pr' }), {
      suite: 'pr',
      skipReason: null,
      draft: false
    });
    assert.deepEqual(resolveSuite.resolveLabSuite({ sourceEvent: 'workflow_dispatch', manualSuite: 'full' }), {
      suite: 'full',
      skipReason: null,
      draft: false
    });
    assert.throws(() => resolveSuite.resolveLabSuite({ sourceEvent: 'workflow_dispatch', manualSuite: 'release' }));
  });

  it('labDedupeKey includes repo sha suite', () => {
    assert.equal(
      resolveSuite.labDedupeKey('JuanCunhaa/Afrika-Veracode-Build', 'abc', 'pr'),
      'JuanCunhaa/Afrika-Veracode-Build:abc:pr'
    );
  });
});

describe('dispatch-and-wait', () => {
  it('dispatch returns run_id → poll exact id → success', async () => {
    const pem = generatePem();
    const sha = 'a'.repeat(40);
    const fetchImpl = mockFetch([
      {
        match: (u, i) => u.includes('/app/installations/99/access_tokens') && i.method === 'POST',
        json: { token: 'ghs_test_token_not_a_secret_for_assert' }
      },
      emptyDedupeList(),
      {
        match: (u, i) => u.includes('/actions/workflows/lab-gate.yml/dispatches') && i.method === 'POST',
        status: 200,
        json: { workflow_run_id: 4242 }
      },
      {
        match: (u) => u.endsWith('/actions/runs/4242'),
        json: {
          id: 4242,
          status: 'completed',
          conclusion: 'success',
          html_url: 'https://example/4242',
          display_title: `Lab Gate | pr | ${sha} | corr-1`,
          name: 'Lab Gate'
        }
      },
      {
        match: (u) => u.includes('/actions/runs/4242/jobs'),
        json: { jobs: [{ name: 'Gate', conclusion: 'success', status: 'completed' }] }
      }
    ]);

    const code = await lab.main(
      {
        LAB_GITHUB_APP_ID: '123',
        LAB_GITHUB_APP_PRIVATE_KEY: pem,
        LAB_GITHUB_APP_INSTALLATION_ID: '99',
        LAB_OWNER: 'JuanCunhaa',
        LAB_REPO: 'Afrika-Veracode-Build-Lab',
        SOURCE_REPOSITORY: 'JuanCunhaa/Afrika-Veracode-Build',
        SOURCE_SHA: sha,
        SUITE: 'pr',
        CORRELATION_ID: 'corr-1',
        POLL_INTERVAL_MS: '1',
        TIMEOUT_MS: '5000',
        GITHUB_API_URL: 'https://api.github.com'
      },
      { fetchImpl, sleep: async () => {}, now: () => Date.now() }
    );
    assert.equal(code, 0);
    assert.ok(fetchImpl.calls.some((c) => c.includes('/actions/runs/4242')));
    assert.ok(fetchImpl.calls.some((c) => c.includes('/dispatches')));
  });

  it('dedupe reuses success for same SHA + suite (no new dispatch)', async () => {
    const pem = generatePem();
    const sha = 'f'.repeat(40);
    const logs = [];
    const fetchImpl = mockFetch([
      {
        match: (u, i) => u.includes('/access_tokens') && i.method === 'POST',
        json: { token: 'ghs_token' }
      },
      {
        match: (u, i) => (i.method || 'GET') === 'GET' && u.includes('/actions/runs?event=workflow_dispatch'),
        json: {
          workflow_runs: [
            {
              id: 9001,
              status: 'completed',
              conclusion: 'success',
              created_at: new Date().toISOString(),
              html_url: 'https://example/9001',
              display_title: `Lab Gate | pr | ${sha} | prior-corr`,
              name: 'Lab Gate'
            }
          ]
        }
      },
      {
        match: (u) => u.endsWith('/actions/runs/9001'),
        json: {
          id: 9001,
          status: 'completed',
          conclusion: 'success',
          html_url: 'https://example/9001',
          display_title: `Lab Gate | pr | ${sha} | prior-corr`,
          name: 'Lab Gate'
        }
      },
      {
        match: (u) => u.includes('/actions/runs/9001/jobs'),
        json: { jobs: [] }
      }
    ]);

    const code = await lab.main(
      {
        LAB_GITHUB_APP_ID: '1',
        LAB_GITHUB_APP_PRIVATE_KEY: pem,
        LAB_GITHUB_APP_INSTALLATION_ID: '9',
        SOURCE_REPOSITORY: 'JuanCunhaa/Afrika-Veracode-Build',
        SOURCE_SHA: sha,
        SUITE: 'pr',
        CORRELATION_ID: 'new-corr',
        POLL_INTERVAL_MS: '1',
        TIMEOUT_MS: '5000'
      },
      {
        fetchImpl,
        sleep: async () => {},
        log: { info: (m) => logs.push(String(m)), log: (m) => logs.push(String(m)) }
      }
    );
    assert.equal(code, 0);
    assert.ok(logs.some((l) => l.includes('LAB_DEDUPE_REUSE')));
    assert.ok(!fetchImpl.calls.some((c) => c.includes('/dispatches')));
  });

  it('dedupe does not reuse different suite for same SHA', async () => {
    const pem = generatePem();
    const sha = '1'.repeat(40);
    const fetchImpl = mockFetch([
      {
        match: (u, i) => u.includes('/access_tokens') && i.method === 'POST',
        json: { token: 'ghs_token' }
      },
      {
        match: (u, i) => (i.method || 'GET') === 'GET' && u.includes('/actions/runs?event=workflow_dispatch'),
        json: {
          workflow_runs: [
            {
              id: 55,
              status: 'completed',
              conclusion: 'success',
              created_at: new Date().toISOString(),
              display_title: `Lab Gate | pr | ${sha} | x`,
              name: 'Lab Gate'
            }
          ]
        }
      },
      {
        match: (u, i) => u.includes('/dispatches') && i.method === 'POST',
        status: 200,
        json: { workflow_run_id: 66 }
      },
      {
        match: (u) => u.endsWith('/actions/runs/66'),
        json: {
          id: 66,
          status: 'completed',
          conclusion: 'success',
          html_url: 'https://example/66',
          display_title: `Lab Gate | full | ${sha} | y`,
          name: 'Lab Gate'
        }
      },
      {
        match: (u) => u.includes('/actions/runs/66/jobs'),
        json: { jobs: [] }
      }
    ]);

    const code = await lab.main(
      {
        LAB_GITHUB_APP_ID: '1',
        LAB_GITHUB_APP_PRIVATE_KEY: pem,
        LAB_GITHUB_APP_INSTALLATION_ID: '9',
        SOURCE_SHA: sha,
        SUITE: 'full',
        CORRELATION_ID: 'full-corr',
        POLL_INTERVAL_MS: '1',
        TIMEOUT_MS: '5000'
      },
      { fetchImpl, sleep: async () => {} }
    );
    assert.equal(code, 0);
    assert.ok(fetchImpl.calls.some((c) => c.includes('/dispatches')));
    assert.ok(fetchImpl.calls.some((c) => c.includes('/actions/runs/66')));
  });

  it('dedupe does not reuse different SHA', async () => {
    const pem = generatePem();
    const shaA = '2'.repeat(40);
    const shaB = '3'.repeat(40);
    assert.equal(lab.runMatchesShaSuite({ display_title: `Lab Gate | pr | ${shaA} | c` }, shaB, 'pr'), false);
    assert.equal(lab.runMatchesShaSuite({ display_title: `Lab Gate | pr | ${shaA} | c` }, shaA, 'pr'), true);
    assert.equal(lab.runMatchesShaSuite({ display_title: `Lab Gate | full | ${shaA} | c` }, shaA, 'pr'), false);
    void pem;
  });

  it('fallback correlation lookup when no workflow_run_id', async () => {
    const pem = generatePem();
    const logs = [];
    let listCalls = 0;
    const fetchImpl = mockFetch([
      {
        match: (u, i) => u.includes('/access_tokens') && i.method === 'POST',
        json: { token: 'ghs_token' }
      },
      {
        match: (u, i) => (i.method || 'GET') === 'GET' && u.includes('/actions/runs?event=workflow_dispatch'),
        json: () => {
          listCalls += 1;
          if (listCalls === 1) return { workflow_runs: [] };
          return {
            workflow_runs: [
              {
                id: 777,
                event: 'workflow_dispatch',
                created_at: new Date().toISOString(),
                display_title: 'Lab Gate | pr | sha | corr-fallback-99',
                name: 'Lab Gate'
              }
            ]
          };
        }
      },
      {
        match: (u, i) => u.includes('/dispatches') && i.method === 'POST',
        status: 204,
        json: null
      },
      {
        match: (u) => u.endsWith('/actions/runs/777'),
        json: {
          id: 777,
          status: 'completed',
          conclusion: 'success',
          html_url: 'https://example/777',
          display_title: 'Lab Gate | pr | sha | corr-fallback-99',
          name: 'Lab Gate'
        }
      },
      {
        match: (u) => u.includes('/actions/runs/777/jobs'),
        json: { jobs: [] }
      }
    ]);

    const code = await lab.main(
      {
        LAB_GITHUB_APP_ID: '123',
        LAB_GITHUB_APP_PRIVATE_KEY: pem,
        LAB_GITHUB_APP_INSTALLATION_ID: '99',
        CORRELATION_ID: 'corr-fallback-99',
        SOURCE_SHA: 'b'.repeat(40),
        SUITE: 'pr',
        POLL_INTERVAL_MS: '1',
        TIMEOUT_MS: '5000'
      },
      {
        fetchImpl,
        sleep: async () => {},
        log: { info: (m) => logs.push(String(m)), log: (m) => logs.push(String(m)) }
      }
    );
    assert.equal(code, 0);
    assert.ok(logs.some((l) => l.includes('LAB_RUN_LOOKUP_FALLBACK correlation_id=corr-fallback-99')));
  });

  it('two simultaneous runs — wrong run ignored; correlation picks correct', async () => {
    const pem = generatePem();
    let listCalls = 0;
    const fetchImpl = mockFetch([
      {
        match: (u, i) => u.includes('/access_tokens') && i.method === 'POST',
        json: { token: 'ghs_token' }
      },
      {
        match: (u, i) => (i.method || 'GET') === 'GET' && u.includes('/actions/runs?event=workflow_dispatch'),
        json: () => {
          listCalls += 1;
          if (listCalls === 1) return { workflow_runs: [] };
          return {
            workflow_runs: [
              {
                id: 1,
                created_at: new Date().toISOString(),
                display_title: 'Lab Gate | pr | sha | OTHER-CORR',
                name: 'Lab Gate'
              },
              {
                id: 2,
                created_at: new Date().toISOString(),
                display_title: 'Lab Gate | pr | sha | WANT-CORR',
                name: 'Lab Gate'
              }
            ]
          };
        }
      },
      {
        match: (u, i) => u.includes('/dispatches') && i.method === 'POST',
        status: 204,
        json: null
      },
      {
        match: (u) => u.endsWith('/actions/runs/2'),
        json: {
          id: 2,
          status: 'completed',
          conclusion: 'success',
          display_title: 'WANT-CORR',
          name: 'Lab Gate'
        }
      },
      {
        match: (u) => u.includes('/actions/runs/2/jobs'),
        json: { jobs: [] }
      }
    ]);

    const code = await lab.main(
      {
        LAB_GITHUB_APP_ID: '1',
        LAB_GITHUB_APP_PRIVATE_KEY: pem,
        LAB_GITHUB_APP_INSTALLATION_ID: '9',
        CORRELATION_ID: 'WANT-CORR',
        SOURCE_SHA: 'c'.repeat(40),
        SUITE: 'pr',
        POLL_INTERVAL_MS: '1',
        TIMEOUT_MS: '5000'
      },
      { fetchImpl, sleep: async () => {} }
    );
    assert.equal(code, 0);
    assert.ok(fetchImpl.calls.some((c) => c.includes('/actions/runs/2')));
    assert.ok(!fetchImpl.calls.some((c) => /\/actions\/runs\/1$/.test(c.split(' ')[1])));
  });

  it('wrong correlation → LAB_RUN_NOT_FOUND', async () => {
    const pem = generatePem();
    let listCalls = 0;
    const fetchImpl = mockFetch([
      {
        match: (u, i) => u.includes('/access_tokens') && i.method === 'POST',
        json: { token: 'ghs_token' }
      },
      {
        match: (u, i) => (i.method || 'GET') === 'GET' && u.includes('/actions/runs?event=workflow_dispatch'),
        json: () => {
          listCalls += 1;
          if (listCalls === 1) return { workflow_runs: [] };
          return {
            workflow_runs: [
              {
                id: 9,
                created_at: new Date().toISOString(),
                display_title: 'Lab Gate | other',
                name: 'Lab Gate'
              }
            ]
          };
        }
      },
      {
        match: (u, i) => u.includes('/dispatches') && i.method === 'POST',
        status: 204,
        json: null
      }
    ]);

    await assert.rejects(
      () =>
        lab.main(
          {
            LAB_GITHUB_APP_ID: '1',
            LAB_GITHUB_APP_PRIVATE_KEY: pem,
            LAB_GITHUB_APP_INSTALLATION_ID: '9',
            CORRELATION_ID: 'missing-corr',
            SOURCE_SHA: 'd'.repeat(40),
            SUITE: 'pr'
          },
          { fetchImpl, sleep: async () => {} }
        ),
      (err) => {
        assert.equal(err.code, 'LAB_RUN_NOT_FOUND');
        assert.ok(!String(err.message).includes(pem.slice(0, 40)));
        return true;
      }
    );
  });

  it('wrong run id from API → LAB_RESULT_INVALID', async () => {
    await assert.rejects(
      () =>
        lab.waitForRun({
          apiUrl: 'https://api.github.com',
          token: 't',
          owner: 'o',
          repo: 'r',
          runId: 100,
          pollIntervalMs: 1,
          timeoutMs: 1000,
          fetchImpl: async () => ({
            ok: true,
            status: 200,
            async json() {
              return { id: 999, status: 'completed', conclusion: 'success' };
            }
          }),
          sleep: async () => {},
          now: () => Date.now()
        }),
      (err) => err.code === 'LAB_RESULT_INVALID'
    );
  });

  it('cancelled run → LAB_RUN_CANCELLED', async () => {
    await assert.rejects(
      () =>
        lab.waitForRun({
          apiUrl: 'https://api.github.com',
          token: 't',
          owner: 'o',
          repo: 'r',
          runId: 5,
          pollIntervalMs: 1,
          timeoutMs: 1000,
          fetchImpl: async () => ({
            ok: true,
            status: 200,
            async json() {
              return { id: 5, status: 'completed', conclusion: 'cancelled' };
            }
          }),
          sleep: async () => {},
          now: () => Date.now()
        }),
      (err) => err.code === 'LAB_RUN_CANCELLED'
    );
  });

  it('timeout while pending → LAB_RUN_TIMEOUT', async () => {
    let t = 0;
    await assert.rejects(
      () =>
        lab.waitForRun({
          apiUrl: 'https://api.github.com',
          token: 't',
          owner: 'o',
          repo: 'r',
          runId: 6,
          pollIntervalMs: 10,
          timeoutMs: 50,
          fetchImpl: async () => ({
            ok: true,
            status: 200,
            async json() {
              return { id: 6, status: 'in_progress', conclusion: null };
            }
          }),
          sleep: async (ms) => {
            t += ms;
          },
          now: () => t
        }),
      (err) => err.code === 'LAB_RUN_TIMEOUT'
    );
  });

  it('failure conclusion → LAB_RUN_FAILED', async () => {
    await assert.rejects(
      () =>
        lab.waitForRun({
          apiUrl: 'https://api.github.com',
          token: 't',
          owner: 'o',
          repo: 'r',
          runId: 7,
          pollIntervalMs: 1,
          timeoutMs: 1000,
          fetchImpl: async () => ({
            ok: true,
            status: 200,
            async json() {
              return { id: 7, status: 'completed', conclusion: 'failure' };
            }
          }),
          sleep: async () => {},
          now: () => Date.now()
        }),
      (err) => err.code === 'LAB_RUN_FAILED'
    );
  });

  it('auth failure → LAB_AUTH_FAILED and secrets never appear in message', async () => {
    const badKey = `-----BEGIN RSA PRIVATE KEY-----\n${FAKE_PRIVATE_KEY_MATERIAL}\n-----END RSA PRIVATE KEY-----`;
    assert.throws(
      () => lab.createAppJwt('123', badKey),
      (err) => {
        assert.equal(err.code, 'LAB_AUTH_FAILED');
        assert.ok(!String(err.message).includes(FAKE_PRIVATE_KEY_MATERIAL));
        assert.ok(!String(err.stack || '').includes(FAKE_PRIVATE_KEY_MATERIAL));
        return true;
      }
    );

    const pem = generatePem();
    const fetchImpl = mockFetch([
      {
        match: (u, i) => u.includes('/access_tokens') && i.method === 'POST',
        status: 401,
        json: { message: 'Bad credentials' }
      }
    ]);
    await assert.rejects(
      () =>
        lab.main(
          {
            LAB_GITHUB_APP_ID: '1',
            LAB_GITHUB_APP_PRIVATE_KEY: pem.replace(/\n/g, '\\n'),
            LAB_GITHUB_APP_INSTALLATION_ID: '9',
            CORRELATION_ID: 'c',
            SOURCE_SHA: 'e'.repeat(40),
            SUITE: 'pr'
          },
          { fetchImpl }
        ),
      (err) => {
        assert.equal(err.code, 'LAB_AUTH_FAILED');
        assert.ok(!String(err.message).includes('BEGIN'));
        assert.ok(!String(err.message).includes(pem.slice(27, 60)));
        return true;
      }
    );
  });

  it('createAppJwt produces three-part RS256 token', () => {
    const pem = generatePem();
    const jwt = lab.createAppJwt('42', pem, 1_700_000_000);
    const parts = jwt.split('.');
    assert.equal(parts.length, 3);
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    assert.equal(header.alg, 'RS256');
  });

  it('dispatchWorkflow failure → LAB_DISPATCH_FAILED', async () => {
    await assert.rejects(
      () =>
        lab.dispatchWorkflow({
          apiUrl: 'https://api.github.com',
          token: 't',
          owner: 'o',
          repo: 'r',
          workflowFile: 'lab-gate.yml',
          ref: 'main',
          inputs: { correlation_id: 'x' },
          fetchImpl: async () => ({
            ok: false,
            status: 403,
            async json() {
              return {};
            }
          })
        }),
      (err) => err.code === 'LAB_DISPATCH_FAILED'
    );
  });

  it('rejects suite=release', async () => {
    const pem = generatePem();
    await assert.rejects(
      () =>
        lab.main(
          {
            LAB_GITHUB_APP_ID: '1',
            LAB_GITHUB_APP_PRIVATE_KEY: pem,
            LAB_GITHUB_APP_INSTALLATION_ID: '9',
            CORRELATION_ID: 'c',
            SOURCE_SHA: 'e'.repeat(40),
            SUITE: 'release'
          },
          {
            fetchImpl: async () => ({
              ok: true,
              status: 200,
              async json() {
                return {};
              }
            })
          }
        ),
      (err) => err.code === 'LAB_RESULT_INVALID' && String(err.message).includes('pr|full')
    );
  });
});
