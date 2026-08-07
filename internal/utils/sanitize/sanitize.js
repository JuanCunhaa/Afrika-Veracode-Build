'use strict';

/**
 * Secret Zero-Leak — sanitizacao centralizada.
 *
 * Defesa em profundidade:
 *   1) ::add-mask:: (GitHub)
 *   2) sanitize* na aplicacao
 *   3) sem persistencia de valores (scrub em writeJson/config)
 *
 * A Action pode conhecer NOMES de secrets; valores nunca devem aparecer em logs/reports.
 */

const REDACTED = '***';

/** @type {Set<string>} */
const registeredSecrets = new Set();

const SECRET_ENV_NAME_RE =
  /(TOKEN|PASSWORD|SECRET|PRIVATE_KEY|PRIVATEKEY|API_KEY|APIKEY|PAT|CREDENTIAL|AUTHORIZATION|PASSWD|CLIENT_SECRET)/i;

const SECRET_OBJECT_KEY_RE =
  /^(token|password|secret|private[_-]?key|authorization|api[_-]?key|client[_-]?secret|credential|passwd|access[_-]?token|refresh[_-]?token|nuget[_-]?token|npm[_-]?token)$/i;

const SECRET_VALUE_RES = [
  /\bghp_[A-Za-z0-9_]{20,}\b/g,
  /\bgho_[A-Za-z0-9_]{20,}\b/g,
  /\bghu_[A-Za-z0-9_]{20,}\b/g,
  /\bghs_[A-Za-z0-9_]{20,}\b/g,
  /\bghr_[A-Za-z0-9_]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bnpm_[A-Za-z0-9]{20,}\b/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/gi,
  /\bBasic\s+[A-Za-z0-9+/=]{8,}\b/gi
];

/** Env keys that must never be registered even if name matches loosely. */
const NEVER_REGISTER_ENV = new Set([
  'PATH',
  'PATHEXT',
  'HOME',
  'USERPROFILE',
  'PWD',
  'OLDPWD',
  'SHELL',
  'TERM',
  'TMP',
  'TEMP',
  'TMPDIR',
  'NODE_OPTIONS',
  'npm_config_user_agent',
  'CI',
  'GITHUB_ACTIONS',
  'RUNNER_OS',
  'RUNNER_TEMP',
  'GITHUB_WORKSPACE',
  'GITHUB_EVENT_PATH',
  'GITHUB_PATH',
  'GITHUB_ENV',
  'GITHUB_OUTPUT',
  'GITHUB_STATE',
  'GITHUB_STEP_SUMMARY'
]);

/**
 * @param {string} name
 * @returns {boolean}
 */
function looksLikeSecretEnvName(name) {
  return SECRET_ENV_NAME_RE.test(String(name || ''));
}

/**
 * @param {string} key
 * @returns {boolean}
 */
function looksLikeSecretObjectKey(key) {
  return SECRET_OBJECT_KEY_RE.test(String(key || '')) || looksLikeSecretEnvName(key);
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function looksLikeSecretValue(value) {
  if (typeof value !== 'string' || value.length < 8) {
    return false;
  }
  if (registeredSecrets.has(value)) return true;
  return SECRET_VALUE_RES.some((re) => {
    re.lastIndex = 0;
    return re.test(value);
  });
}

/**
 * Registra valor sensivel para masking local + ::add-mask::.
 * @param {string} value
 */
function registerSecret(value) {
  const v = String(value || '').trim();
  if (!v || v.length < 4) return;
  if (v === 'true' || v === 'false' || v === 'null' || v === 'undefined') return;
  registeredSecrets.add(v);
  // Também mascarar substrings longas multilinha (private keys)
  if (v.includes('\n')) {
    for (const line of v.split(/\r?\n/)) {
      const t = line.trim();
      if (t.length >= 8 && !t.startsWith('-----')) registeredSecrets.add(t);
    }
  }
  console.log(`::add-mask::${v}`);
}

/**
 * Alias de registerSecret (API pedida).
 * @param {string} value
 */
function maskValue(value) {
  registerSecret(value);
}

/**
 * Registra secrets a partir de process.env (somente nomes secret-like).
 * @param {NodeJS.ProcessEnv} [env]
 */
function registerSecretsFromEnv(env = process.env) {
  for (const [key, raw] of Object.entries(env || {})) {
    if (NEVER_REGISTER_ENV.has(key)) continue;
    if (!looksLikeSecretEnvName(key)) continue;
    if (raw === undefined || raw === null || raw === '') continue;
    registerSecret(String(raw));
  }
}

/**
 * @returns {string[]}
 */
function getRegisteredSecrets() {
  return [...registeredSecrets];
}

/** @private */
function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Sanitiza texto (logs, stdout/stderr, summaries).
 * @param {string} text
 * @returns {string}
 */
function sanitizeText(text) {
  let out = String(text ?? '');

  // 1) Registered exact values (longest first)
  const regs = [...registeredSecrets].sort((a, b) => b.length - a.length);
  for (const secret of regs) {
    if (!secret) continue;
    out = out.split(secret).join(REDACTED);
  }

  // 2) URLs with embedded credentials
  out = out.replace(/([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)([^/\s:@]+):([^/\s@]+)@/g, `$1${REDACTED}:${REDACTED}@`);

  // 3) Sensitive query params
  out = out.replace(
    /([?&](?:token|api[_-]?key|password|passwd|access[_-]?token|refresh[_-]?token|secret|client[_-]?secret)=)([^&\s"'<>]+)/gi,
    `$1${REDACTED}`
  );

  // 4) Authorization / Cookie headers
  out = out.replace(/(Authorization\s*:\s*)(Bearer\s+)?([^\s\r\n]+)/gi, (_m, p1, bearer) => {
    return `${p1}${bearer || ''}${REDACTED}`;
  });
  out = out.replace(/(Cookie\s*:\s*)([^\r\n]+)/gi, `$1${REDACTED}`);
  out = out.replace(/(X-Api-Key\s*:\s*)([^\s\r\n]+)/gi, `$1${REDACTED}`);

  // 5) NAME=value for secret-like env names
  out = out.replace(
    /\b([A-Z][A-Z0-9_]*(?:TOKEN|PASSWORD|SECRET|PRIVATE_KEY|API_KEY|APIKEY|PAT|CREDENTIAL|AUTHORIZATION|PASSWD|CLIENT_SECRET)[A-Z0-9_]*)=([^\s"'`;|&]+)/g,
    `$1=${REDACTED}`
  );

  // 6) key: value / key=value for common secret property names
  out = out.replace(
    /\b(token|password|passwd|secret|api[_-]?key|access[_-]?token|client[_-]?secret|authorization|private[_-]?key)\s*[:=]\s*([^\s,;|&"']+)/gi,
    `$1=${REDACTED}`
  );

  // 7) "using token VALUE" / "with password VALUE"
  out = out.replace(
    /\b(using|with)\s+(token|password|secret|api[_-]?key|credential)s?\s+([^\s,;]+)/gi,
    `$1 $2 ${REDACTED}`
  );

  // 8) Known high-entropy patterns
  for (const re of SECRET_VALUE_RES) {
    re.lastIndex = 0;
    out = out.replace(re, REDACTED);
  }

  return out;
}

/** @deprecated use sanitizeText — mantido para compatibilidade */
function sanitizeLog(text) {
  return sanitizeText(text);
}

/**
 * Sanitiza Error / exception (message + stack).
 * @param {unknown} err
 * @returns {Error}
 */
function sanitizeError(err) {
  if (err instanceof Error) {
    const clean = new Error(sanitizeText(err.message || String(err)));
    clean.name = err.name;
    clean.code = err.code;
    if (err.stack) clean.stack = sanitizeText(err.stack);
    if (err.output) clean.output = sanitizeText(String(err.output));
    return clean;
  }
  return new Error(sanitizeText(String(err)));
}

/**
 * Sanitiza linha de comando (cmd + args) para logging.
 * Mascara args apos flags sensiveis.
 * @param {string} cmd
 * @param {string[]|string} [args]
 * @returns {string}
 */
function sanitizeCommand(cmd, args = []) {
  const list = Array.isArray(args)
    ? args.slice()
    : String(args || '')
        .split(/\s+/)
        .filter(Boolean);
  const sensitiveFlags = new Set([
    '--password',
    '-password',
    '--token',
    '--api-key',
    '--apikey',
    '--secret',
    '--client-secret',
    '--access-token',
    '/p:Password',
    '/p:password'
  ]);

  const rendered = [];
  for (let i = 0; i < list.length; i += 1) {
    const a = String(list[i]);
    const lower = a.toLowerCase();
    if (sensitiveFlags.has(a) || sensitiveFlags.has(lower)) {
      rendered.push(a);
      if (i + 1 < list.length) {
        rendered.push(REDACTED);
        i += 1;
      }
      continue;
    }
    // --password=VALUE / -p:Password=VALUE
    if (/^(--?(password|token|api-?key|secret|client-secret|access-token)=)/i.test(a)) {
      rendered.push(a.replace(/=.*/, `=${REDACTED}`));
      continue;
    }
    if (/^\/p:(Password|password)=/i.test(a)) {
      rendered.push(a.replace(/=.*/, `=${REDACTED}`));
      continue;
    }
    rendered.push(a);
  }

  const line = `$ ${cmd} ${rendered.join(' ')}`.trim();
  return sanitizeText(line);
}

/**
 * Remove / mascara secrets de objetos antes de persistir ou logar.
 * @param {unknown} input
 * @returns {unknown}
 */
function sanitizeObject(input) {
  return scrubSecretsFromObject(input);
}

/**
 * Remove chaves/valores secretos de objetos antes de persistir config/reports.
 * @param {unknown} input
 * @returns {unknown}
 */
function scrubSecretsFromObject(input) {
  if (Array.isArray(input)) {
    return input.map((item) => scrubSecretsFromObject(item));
  }
  if (!input || typeof input !== 'object') {
    if (typeof input === 'string') {
      if (looksLikeSecretValue(input) || registeredSecrets.has(input)) {
        return REDACTED;
      }
      return sanitizeText(input);
    }
    return input;
  }

  const out = {};
  for (const [key, value] of Object.entries(input)) {
    // Nunca persiste valores string sob chaves secret-like.
    // Arrays de nomes (requiredEnvironmentVariables) passam pelo branch Array.
    if (looksLikeSecretObjectKey(key) && typeof value === 'string' && value.length > 0) {
      continue;
    }
    if (looksLikeSecretEnvName(key) && typeof value === 'string' && value.length > 0) {
      continue;
    }
    if (typeof value === 'string' && (looksLikeSecretValue(value) || registeredSecrets.has(value))) {
      continue;
    }
    out[key] = scrubSecretsFromObject(value);
  }
  return out;
}

/**
 * Garante que requiredEnvironmentVariables contem apenas nomes.
 * @param {string[]} vars
 * @returns {string[]}
 */
function normalizeRequiredEnvVars(vars) {
  const list = Array.isArray(vars) ? vars : [];
  const cleaned = [];
  for (const item of list) {
    const name = String(item || '').trim();
    if (!name) continue;
    if (!/^[A-Z][A-Z0-9_]*$/.test(name)) {
      throw new Error(
        `requiredEnvironmentVariables deve conter apenas nomes de variaveis (recebido: ${sanitizeText(name)})`
      );
    }
    if (!cleaned.includes(name)) {
      cleaned.push(name);
    }
  }
  return cleaned;
}

/**
 * Test-only: limpa registry (nao usar em producao).
 */
function _resetRegisteredSecretsForTests() {
  registeredSecrets.clear();
}

module.exports = {
  REDACTED,
  looksLikeSecretEnvName,
  looksLikeSecretObjectKey,
  looksLikeSecretValue,
  registerSecret,
  registerSecretsFromEnv,
  getRegisteredSecrets,
  maskValue,
  sanitizeText,
  sanitizeLog,
  sanitizeError,
  sanitizeCommand,
  sanitizeObject,
  scrubSecretsFromObject,
  normalizeRequiredEnvVars,
  _resetRegisteredSecretsForTests,
  escapeRegExp
};
