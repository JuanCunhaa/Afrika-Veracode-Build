'use strict';

/**
 * Sanitizacao defensiva de logs e payloads de config.
 * Nunca persiste ou imprime valores de secrets.
 */

const SECRET_ENV_NAME_RE = /(TOKEN|PASSWORD|SECRET|PRIVATE_KEY|API_KEY|APIKEY|PAT|CREDENTIAL|AUTH|PASSWD)/i;

const SECRET_VALUE_RE = [
  /\bghp_[A-Za-z0-9_]{20,}\b/g,
  /\bgho_[A-Za-z0-9_]{20,}\b/g,
  /\bghu_[A-Za-z0-9_]{20,}\b/g,
  /\bghs_[A-Za-z0-9_]{20,}\b/g,
  /\bghr_[A-Za-z0-9_]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bnpm_[A-Za-z0-9]{20,}\b/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/gi
];

/**
 * @param {string} name
 * @returns {boolean}
 */
function looksLikeSecretEnvName(name) {
  return SECRET_ENV_NAME_RE.test(String(name || ''));
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function looksLikeSecretValue(value) {
  if (typeof value !== 'string' || value.length < 8) {
    return false;
  }
  return SECRET_VALUE_RE.some((re) => {
    re.lastIndex = 0;
    return re.test(value);
  });
}

/**
 * Mascara valores sensiveis em texto de log.
 * @param {string} text
 * @returns {string}
 */
function sanitizeLog(text) {
  let out = String(text ?? '');
  for (const re of SECRET_VALUE_RE) {
    re.lastIndex = 0;
    out = out.replace(re, '[REDACTED]');
  }
  return out;
}

/**
 * Emite ::add-mask:: para um valor nao vazio.
 * @param {string} value
 */
function maskValue(value) {
  const v = String(value || '').trim();
  if (!v) return;
  console.log(`::add-mask::${v}`);
}

/**
 * Remove chaves/valores secretos de objetos antes de persistir config.
 * @param {unknown} input
 * @returns {unknown}
 */
function scrubSecretsFromObject(input) {
  if (Array.isArray(input)) {
    return input.map((item) => scrubSecretsFromObject(item));
  }
  if (!input || typeof input !== 'object') {
    if (looksLikeSecretValue(input)) {
      return '[REDACTED]';
    }
    return input;
  }

  const out = {};
  for (const [key, value] of Object.entries(input)) {
    if (looksLikeSecretEnvName(key) && typeof value === 'string' && value.length > 0 && !isEnvVarNameOnly(key, value)) {
      // Permite listas de nomes de variaveis; bloqueia valores.
      if (looksLikeSecretValue(value) || !/^[A-Z][A-Z0-9_]*$/.test(value)) {
        continue;
      }
    }
    if (looksLikeSecretValue(value)) {
      continue;
    }
    out[key] = scrubSecretsFromObject(value);
  }
  return out;
}

/**
 * @param {string} key
 * @param {string} value
 * @returns {boolean}
 */
function isEnvVarNameOnly(key, value) {
  return key === 'requiredEnvironmentVariables' || /^[A-Z][A-Z0-9_]*$/.test(value);
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
        `requiredEnvironmentVariables deve conter apenas nomes de variaveis (recebido: ${sanitizeLog(name)})`
      );
    }
    if (!cleaned.includes(name)) {
      cleaned.push(name);
    }
  }
  return cleaned;
}

module.exports = {
  looksLikeSecretEnvName,
  looksLikeSecretValue,
  sanitizeLog,
  maskValue,
  scrubSecretsFromObject,
  normalizeRequiredEnvVars
};
