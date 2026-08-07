'use strict';

/**
 * Secret Zero-Leak suite — secrets sinteticos apenas.
 * Falha com SECRET_LEAK_DETECTED se qualquer ocorrencia for encontrada.
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  sanitizeText,
  sanitizeError,
  sanitizeCommand,
  sanitizeObject,
  scrubSecretsFromObject,
  registerSecret,
  registerSecretsFromEnv,
  _resetRegisteredSecretsForTests,
  REDACTED
} = require('../../../internal/utils/sanitize/sanitize');
const { fail, ERROR_CODES } = require('../../../internal/utils/errors/errors');
const { writeJson, appendStepSummary } = require('../../../internal/utils/common/io');
const { validateBuildConfig } = require('../../../internal/utils/schemas/validate');

const SECRETS = {
  SUPER: 'SUPER_SECRET_TEST_839201',
  NUGET: 'NUGET_SECRET_983475',
  GITHUB: 'GITHUB_TOKEN_FAKE_192837'
};

function assertNoLeak(haystack, label) {
  const text = String(haystack ?? '');
  for (const [name, value] of Object.entries(SECRETS)) {
    if (text.includes(value)) {
      const err = new Error(`SECURITY TEST FAILED\nSECRET_LEAK_DETECTED\nSecret ${name} found in ${label}`);
      err.code = ERROR_CODES.SECRET_LEAK_DETECTED;
      throw err;
    }
  }
}

function walkFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkFiles(full, acc);
    else acc.push(full);
  }
  return acc;
}

describe('secret-leak / sanitize core', () => {
  beforeEach(() => {
    _resetRegisteredSecretsForTests();
  });

  afterEach(() => {
    _resetRegisteredSecretsForTests();
  });

  it('registerSecret + sanitizeText mascaram valor sintetico', () => {
    registerSecret(SECRETS.SUPER);
    const out = sanitizeText(`Authentication failed using token ${SECRETS.SUPER}`);
    assertNoLeak(out, 'sanitizeText auth');
    assert.ok(out.includes(REDACTED));
  });

  it('NUGET_TOKEN=value nunca aparece expandido', () => {
    const out = sanitizeText(`NUGET_TOKEN=${SECRETS.NUGET} restore ok`);
    assertNoLeak(out, 'env assignment');
    assert.match(out, /NUGET_TOKEN=\*\*\*/);
  });

  it('sanitizeCommand mascara --password', () => {
    const line = sanitizeCommand('dotnet', [
      'nuget',
      'add',
      'source',
      'https://pkgs.example/',
      '--password',
      SECRETS.NUGET
    ]);
    assertNoLeak(line, 'sanitizeCommand');
    assert.match(line, /--password \*\*\*/);
  });

  it('URL com credentials e query token sao mascarados', () => {
    const out = sanitizeText(`fetch https://user:${SECRETS.SUPER}@example.com/x?token=${SECRETS.GITHUB}&ok=1`);
    assertNoLeak(out, 'url');
    assert.match(out, /\*\*\*:\*\*\*@/);
    assert.match(out, /token=\*\*\*/);
  });

  it('Authorization Bearer e headers sensiveis', () => {
    const out = sanitizeText(
      `Authorization: Bearer ${SECRETS.GITHUB}\nX-Api-Key: ${SECRETS.NUGET}\nCookie: sid=${SECRETS.SUPER}`
    );
    assertNoLeak(out, 'headers');
  });

  it('sanitizeError limpa message e stack', () => {
    registerSecret(SECRETS.SUPER);
    let err;
    try {
      throw new Error(`boom token=${SECRETS.SUPER}`);
    } catch (e) {
      err = sanitizeError(e);
    }
    assertNoLeak(err.message, 'error.message');
    assertNoLeak(err.stack, 'error.stack');
  });

  it('registerSecretsFromEnv registra NUGET_TOKEN', () => {
    process.env.NUGET_TOKEN = SECRETS.NUGET;
    try {
      registerSecretsFromEnv({ NUGET_TOKEN: SECRETS.NUGET, PATH: '/usr/bin' });
      const out = sanitizeText(`using token ${SECRETS.NUGET}`);
      assertNoLeak(out, 'fromEnv');
    } finally {
      delete process.env.NUGET_TOKEN;
    }
  });

  it('sanitizeObject / scrub remove valores sob chaves secret-like', () => {
    const cleaned = sanitizeObject({
      NUGET_TOKEN: SECRETS.NUGET,
      password: SECRETS.SUPER,
      ok: 'safe',
      dependencies: { requiredEnvironmentVariables: ['NUGET_TOKEN'] }
    });
    assert.equal(cleaned.ok, 'safe');
    assert.ok(!cleaned.NUGET_TOKEN);
    assert.ok(!cleaned.password);
    assertNoLeak(JSON.stringify(cleaned), 'sanitizeObject');
  });
});

describe('secret-leak / error paths', () => {
  beforeEach(() => _resetRegisteredSecretsForTests());
  afterEach(() => _resetRegisteredSecretsForTests());

  it('fail() nao vaza secret em detected/howToFix', () => {
    registerSecret(SECRETS.SUPER);
    const logs = [];
    const orig = console.error;
    console.error = (...args) => logs.push(args.join(' '));
    try {
      assert.throws(() =>
        fail(ERROR_CODES.DEPENDENCY_AUTH_REQUIRED, `NuGet 401 using token ${SECRETS.SUPER}`, {
          detected: `Authentication failed using token ${SECRETS.SUPER}`,
          stage: 'Dependency Restore',
          howToFix: `export NUGET_TOKEN=${SECRETS.SUPER}`
        })
      );
    } finally {
      console.error = orig;
    }
    const joined = logs.join('\n');
    assertNoLeak(joined, 'fail() console');
  });

  it('Maven/NPM/GitHub auth error texts sao sanitizados', () => {
    registerSecret(SECRETS.SUPER);
    registerSecret(SECRETS.NUGET);
    registerSecret(SECRETS.GITHUB);
    const samples = [
      `Could not transfer artifact: 401 Unauthorized token ${SECRETS.NUGET}`,
      `npm ERR! 401 Unauthorized - GET https://registry.npmjs.org/-/user/org.couchdb.user:x - ${SECRETS.SUPER}`,
      `GitHub API error: Bad credentials ${SECRETS.GITHUB}`,
      `Authorization: Bearer ${SECRETS.GITHUB}`
    ];
    for (const s of samples) {
      assertNoLeak(sanitizeText(s), s.slice(0, 40));
    }
  });
});

describe('secret-leak / persistence + summary', () => {
  beforeEach(() => _resetRegisteredSecretsForTests());
  afterEach(() => _resetRegisteredSecretsForTests());

  it('writeJson e step summary nunca persistem secrets', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'avb-leak-'));
    const veracode = path.join(root, '.veracode-build');
    fs.mkdirSync(veracode, { recursive: true });

    registerSecret(SECRETS.SUPER);
    registerSecret(SECRETS.NUGET);
    registerSecret(SECRETS.GITHUB);
    writeJson(path.join(veracode, 'discovery-result.json'), {
      language: 'javascript',
      NUGET_TOKEN: SECRETS.SUPER,
      note: `token=${SECRETS.SUPER}`
    });
    writeJson(path.join(veracode, 'doctor-result.json'), {
      status: 'READY',
      checks: [{ id: 'X', status: 'PASS', message: `ok ${SECRETS.NUGET}` }]
    });

    const cfg = validateBuildConfig(
      scrubSecretsFromObject({
        schemaVersion: 1,
        repository: 'org/app',
        discovery: { language: 'javascript', confidence: 'HIGH' },
        builder: { strategy: 'SOURCE_PACKAGE' },
        fingerprint: { algorithm: 'sha256', value: 'abc' },
        NUGET_TOKEN: SECRETS.SUPER,
        dependencies: { requiredEnvironmentVariables: ['NUGET_TOKEN'] }
      })
    );
    writeJson(path.join(veracode, 'build-config.json'), cfg);

    const summaryFile = path.join(root, 'summary.md');
    process.env.GITHUB_STEP_SUMMARY = summaryFile;
    try {
      appendStepSummary(`## Report\nNUGET_TOKEN=${SECRETS.NUGET}\ntoken ${SECRETS.SUPER}`);
    } finally {
      delete process.env.GITHUB_STEP_SUMMARY;
    }

    for (const file of walkFiles(root)) {
      assertNoLeak(fs.readFileSync(file, 'utf8'), file);
    }
  });

  it('busca global: 0 ocorrencias dos secrets sinteticos em fixture gerada', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'avb-global-'));
    registerSecret(SECRETS.SUPER);
    registerSecret(SECRETS.NUGET);
    registerSecret(SECRETS.GITHUB);

    const poisoned = {
      stdout: `Authentication failed using token ${SECRETS.SUPER}`,
      cmd: sanitizeCommand('dotnet', ['nuget', 'add', 'source', 'x', '--password', SECRETS.NUGET]),
      url: sanitizeText(`https://x:${SECRETS.GITHUB}@host/?access_token=${SECRETS.GITHUB}`),
      err: sanitizeError(new Error(`stack ${SECRETS.SUPER}`)).stack
    };
    writeJson(path.join(root, 'capture.json'), poisoned);

    let hits = 0;
    for (const file of walkFiles(root)) {
      const text = fs.readFileSync(file, 'utf8');
      for (const value of Object.values(SECRETS)) {
        if (text.includes(value)) hits += 1;
      }
    }
    assert.equal(hits, 0, 'SECRET_LEAK_DETECTED: global search found synthetic secrets');
  });
});
