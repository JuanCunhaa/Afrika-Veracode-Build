'use strict';

/**
 * GitHub App / PAT helpers for Afrika-Veracode-Build config store.
 * CLI:
 *   node github-config.js resolve-token
 *   node github-config.js check-repo
 *   node github-config.js get-config
 *   node github-config.js put-config
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { scrubSecretsFromObject, maskValue, sanitizeLog } = require('../sanitize/sanitize');
const { migrateBuildConfig, validateBuildConfig } = require('../schemas/validate');

const DEFAULT_CONFIG_REPO = 'Afrika-Veracode-Build-Configs';
const COMMIT_IDENTITY = {
  name: '[BOT] Afrika-Veracode-Build-Configs',
  email: 'veracode.build@afrikatech.com.br'
};

function setOutput(name, value) {
  const out = process.env.GITHUB_OUTPUT;
  if (out) fs.appendFileSync(out, `${name}=${value}\n`);
}

function githubApiBase() {
  if (process.env.GITHUB_API_URL) {
    return process.env.GITHUB_API_URL.replace(/\/$/, '');
  }
  const serverUrl = (process.env.GITHUB_SERVER_URL || 'https://github.com').replace(/\/$/, '');
  return serverUrl === 'https://github.com' ? 'https://api.github.com' : `${serverUrl}/api/v3`;
}

function normalizePem(raw) {
  if (!raw) return '';
  let key = String(raw).trim();
  if (key.includes('\\n') && !key.includes('\n')) {
    key = key.replace(/\\n/g, '\n');
  }
  return key;
}

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function createAppJwt(appId, privateKeyPem) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = { iat: now - 60, exp: now + 9 * 60, iss: String(appId) };
  const segments = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(segments);
  sign.end();
  const signature = sign
    .sign(privateKeyPem)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${segments}.${signature}`;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { response, json, text };
}

async function resolveAccessToken() {
  const appId = (process.env.CONFIG_GITHUB_APP_ID || '').trim();
  const privateKey = normalizePem(process.env.CONFIG_GITHUB_APP_PRIVATE_KEY || '');
  const installationId = (process.env.CONFIG_GITHUB_APP_INSTALLATION_ID || '').trim();
  const pat = (process.env.CONFIG_GITHUB_TOKEN || '').trim();

  if (appId && privateKey && installationId) {
    maskValue(privateKey);
    const jwt = createAppJwt(appId, privateKey);
    maskValue(jwt);
    const api = githubApiBase();
    const { response, json, text } = await fetchJson(`${api}/app/installations/${installationId}/access_tokens`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json'
      },
      body: '{}'
    });
    if (!response.ok || !json?.token) {
      throw Object.assign(
        new Error(`CONFIG_AUTH_FAILED: HTTP ${response.status}: ${sanitizeLog(text.slice(0, 300))}`),
        {
          code: 'CONFIG_AUTH_FAILED'
        }
      );
    }
    maskValue(json.token);
    return { token: json.token, source: 'github_app' };
  }

  if (pat) {
    maskValue(pat);
    return { token: pat, source: 'pat' };
  }

  throw Object.assign(
    new Error(
      'CONFIG_AUTH_FAILED: informe GitHub App (config_github_app_id/private_key/installation_id) ou config_github_token.'
    ),
    { code: 'CONFIG_AUTH_FAILED' }
  );
}

function configContentPath(scanRepository) {
  const parts = String(scanRepository || '').split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`repository_full_name invalido: '${scanRepository}'`);
  }
  return `${parts[0]}/${parts[1]}/build-config.json`;
}

function encodeContentPath(filePath) {
  return filePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

async function checkRepoExists(token, configOrg, configRepo) {
  const api = githubApiBase();
  const { response, text } = await fetchJson(
    `${api}/repos/${encodeURIComponent(configOrg)}/${encodeURIComponent(configRepo)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (response.status === 404) {
    throw Object.assign(new Error(`CONFIG_REPO_NOT_FOUND: '${configOrg}/${configRepo}' nao existe.`), {
      code: 'CONFIG_REPO_NOT_FOUND'
    });
  }
  if (response.status === 401 || response.status === 403) {
    throw Object.assign(
      new Error(`CONFIG_AUTH_FAILED: sem acesso a '${configOrg}/${configRepo}' (HTTP ${response.status}).`),
      { code: 'CONFIG_AUTH_FAILED' }
    );
  }
  if (!response.ok) {
    throw new Error(`Falha ao verificar repo de config (HTTP ${response.status}): ${sanitizeLog(text.slice(0, 300))}`);
  }
  return true;
}

async function getConfig(token, configOrg, configRepo, scanRepository, outFile) {
  const api = githubApiBase();
  const relativePath = configContentPath(scanRepository);
  const url = `${api}/repos/${encodeURIComponent(configOrg)}/${encodeURIComponent(configRepo)}/contents/${encodeContentPath(relativePath)}`;
  const { response, json, text } = await fetchJson(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (response.status === 404) {
    setOutput('has_config', 'false');
    setOutput('config_sha', '');
    console.log(`Build config nao encontrado em ${configOrg}/${configRepo}/${relativePath}`);
    return { hasConfig: false };
  }
  if (!response.ok) {
    throw Object.assign(new Error(`CONFIG_READ_FAILED: HTTP ${response.status}: ${sanitizeLog(text.slice(0, 300))}`), {
      code: 'CONFIG_READ_FAILED'
    });
  }

  const decoded = Buffer.from(String(json.content).replace(/\n/g, ''), 'base64').toString('utf8');
  let parsed;
  try {
    parsed = migrateBuildConfig(JSON.parse(decoded));
  } catch (err) {
    if (err.code === 'CONFIG_STALE') {
      setOutput('has_config', 'false');
      setOutput('config_status', 'stale_schema');
      return { hasConfig: false, stale: true };
    }
    throw Object.assign(new Error(`CONFIG_READ_FAILED: ${err.message}`), { code: 'CONFIG_READ_FAILED' });
  }

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
  setOutput('has_config', 'true');
  setOutput('config_sha', json.sha || '');
  setOutput('config_path', `${configOrg}/${configRepo}/${relativePath}`);
  console.log(`Build config carregado: ${configOrg}/${configRepo}/${relativePath}`);
  return { hasConfig: true, sha: json.sha, config: parsed };
}

async function putConfig(token, configOrg, configRepo, scanRepository, configObject, knownSha) {
  const cleaned = validateBuildConfig(scrubSecretsFromObject(configObject));
  const api = githubApiBase();
  const relativePath = configContentPath(scanRepository);
  const url = `${api}/repos/${encodeURIComponent(configOrg)}/${encodeURIComponent(configRepo)}/contents/${encodeContentPath(relativePath)}`;

  async function doPut(sha) {
    const body = {
      message: `Update build-config for ${scanRepository}`,
      content: Buffer.from(`${JSON.stringify(cleaned, null, 2)}\n`, 'utf8').toString('base64'),
      author: COMMIT_IDENTITY,
      committer: COMMIT_IDENTITY
    };
    if (sha) body.sha = sha;
    return fetchJson(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
  }

  let sha = knownSha;
  if (!sha) {
    const existing = await fetchJson(url, { headers: { Authorization: `Bearer ${token}` } });
    if (existing.response.status === 200) sha = existing.json.sha;
  }

  let result = await doPut(sha);
  if (result.response.status === 409 || result.response.status === 422) {
    console.log('::warning::Conflito ao gravar build-config (409/422). Re-GET e retry unico.');
    const again = await fetchJson(url, { headers: { Authorization: `Bearer ${token}` } });
    const newSha = again.response.status === 200 ? again.json.sha : undefined;
    result = await doPut(newSha);
    if (result.response.status === 409 || result.response.status === 422) {
      throw Object.assign(new Error('CONFIG_WRITE_FAILED: conflito persistente apos retry.'), {
        code: 'CONFIG_WRITE_FAILED'
      });
    }
  }

  if (!result.response.ok) {
    throw Object.assign(
      new Error(`CONFIG_WRITE_FAILED: HTTP ${result.response.status}: ${sanitizeLog(result.text.slice(0, 300))}`),
      { code: 'CONFIG_WRITE_FAILED' }
    );
  }

  setOutput('config_saved', 'true');
  setOutput('config_path', `${configOrg}/${configRepo}/${relativePath}`);
  console.log(`Build config gravado/atualizado: ${configOrg}/${configRepo}/${relativePath}`);
  return { saved: true };
}

function buildConfigDocument({ repository, plan, fingerprint, discovery: _discovery }) {
  return scrubSecretsFromObject({
    schemaVersion: 1,
    repository,
    projectPath: plan.projectPath || '.',
    discovery: {
      language: plan.language,
      framework: plan.framework,
      runtimeVersion: plan.runtimeVersion,
      buildSystem: plan.buildSystem,
      packageManager: plan.packageManager,
      projectType: plan.projectType,
      confidence: plan.confidence,
      packagingStrategy: plan.strategy,
      targetFrameworks: plan.targetFrameworks,
      hasLockfile: plan.hasLockfile
    },
    builder: {
      strategy: plan.strategy,
      wrapper: plan.wrapper,
      artifactPatterns: plan.artifact?.patterns || [],
      runTests: Boolean(plan.runTests),
      runnerRequirements: plan.runnerRequirements,
      testProjects: plan.testProjects
    },
    dependencies: {
      privateRegistryDetected: Boolean(plan.privateRegistryDetected),
      requiredEnvironmentVariables: plan.requiredEnvironmentVariables || []
    },
    doctor: {
      profile: plan.doctorProfile
    },
    fingerprint: {
      algorithm: fingerprint.algorithm || 'sha256',
      value: fingerprint.value
    },
    generatedBy: {
      action: 'Afrika-Veracode-Build',
      actionVersion: '0.1.0'
    },
    updatedAt: new Date().toISOString()
  });
}

async function main() {
  const command = process.argv[2];
  const configOrg = (process.env.CONFIG_ORG || '').trim();
  const configRepo = (process.env.CONFIG_REPO || DEFAULT_CONFIG_REPO).trim();
  const scanRepository = (process.env.SCAN_REPOSITORY || process.env.GITHUB_REPOSITORY || '').trim();
  const outFile = (process.env.CONFIG_OUT_FILE || '.veracode-build/build-config.json').trim();
  const mode = (process.env.CONFIG_MODE || 'auto').trim();

  if (!command) {
    throw new Error('Uso: node github-config.js <resolve-token|check-repo|get-config|put-config|decide>');
  }

  if (command === 'decide') {
    // Local decision helper without network when disabled
    setOutput('should_fetch', mode === 'disabled' || mode === 'refresh' ? 'false' : 'true');
    setOutput('should_save', mode === 'disabled' || mode === 'readonly' ? 'false' : 'true');
    setOutput('force_rediscover', mode === 'refresh' ? 'true' : 'false');
    return;
  }

  const { token, source } = await resolveAccessToken();
  console.log(`Autenticacao config-store via: ${source}`);

  if (!configOrg) {
    throw new Error('config_org e obrigatorio para operacoes remotas.');
  }

  if (command === 'resolve-token') {
    const tokenFile = process.env.TOKEN_FILE || path.join(process.cwd(), '.build-config-github-token');
    fs.writeFileSync(tokenFile, token, { encoding: 'utf8', mode: 0o600 });
    setOutput('token_file', tokenFile);
    setOutput('token_source', source);
    return;
  }

  if (command === 'check-repo') {
    await checkRepoExists(token, configOrg, configRepo);
    return;
  }

  if (command === 'get-config') {
    await getConfig(token, configOrg, configRepo, scanRepository, outFile);
    return;
  }

  if (command === 'put-config') {
    const configFile = process.env.CONFIG_FILE || outFile;
    const knownSha = (process.env.CONFIG_SHA || '').trim() || undefined;
    const obj = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    await putConfig(token, configOrg, configRepo, scanRepository, obj, knownSha);
    return;
  }

  throw new Error(`Comando desconhecido: ${command}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`::error::${err.message || err}`);
    process.exit(1);
  });
}

module.exports = {
  resolveAccessToken,
  checkRepoExists,
  getConfig,
  putConfig,
  configContentPath,
  buildConfigDocument,
  createAppJwt,
  normalizePem,
  githubApiBase,
  DEFAULT_CONFIG_REPO,
  COMMIT_IDENTITY
};
