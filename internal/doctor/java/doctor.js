'use strict';

const path = require('path');
const { spawnSync } = require('child_process');
const { listZipEntries, finalizeStatus, genericChecks } = require('../common');

function hasClassEntries(entries) {
  return entries.some((e) => e.toLowerCase().endsWith('.class'));
}

function checkWarStructure(entries) {
  const lower = entries.map((e) => e.replace(/\\/g, '/').toLowerCase());
  const need = ['web-inf/', 'web-inf/classes/', 'web-inf/lib/'];
  const missing = need.filter((n) => !lower.some((e) => e.includes(n)));
  return missing;
}

/**
 * @param {string} artifactPath
 * @param {object} plan
 */
function doctorJava(artifactPath, plan = {}) {
  const checks = [...genericChecks(artifactPath)];
  if (checks.some((c) => c.status === 'FAIL')) {
    return { status: finalizeStatus(checks), checks, language: 'java', artifact: artifactPath };
  }

  let entries = [];
  try {
    entries = listZipEntries(artifactPath);
  } catch (err) {
    checks.push({ id: 'JAVA_ARCHIVE', status: 'FAIL', message: err.message });
    return { status: 'INVALID', checks, language: 'java', artifact: artifactPath };
  }

  if (plan.doctorProfile === 'java-source' || plan.javaPackageMode === 'source') {
    const hasJava = entries.some((e) => e.toLowerCase().endsWith('.java'));
    checks.push(
      hasJava
        ? { id: 'JAVA_SOURCE_PRESENT', status: 'PASS' }
        : { id: 'JAVA_SOURCE_PRESENT', status: 'FAIL', message: 'Nenhum .java no source package.' }
    );
  } else {
    // classes
    if (
      hasClassEntries(entries) ||
      entries.some(
        (e) => e.toLowerCase().endsWith('.jar') || e.toLowerCase().endsWith('.war') || e.toLowerCase().endsWith('.ear')
      )
    ) {
      // If zip contains jar/war, inspect names
      const hasBytecodeContainer = entries.some((e) => /\.(jar|war|ear|class)$/i.test(e));
      checks.push(
        hasBytecodeContainer
          ? { id: 'JAVA_BYTECODE_PRESENT', status: 'PASS' }
          : { id: 'JAVA_BYTECODE_PRESENT', status: 'FAIL', message: 'Bytecode .class nao encontrado.' }
      );
    } else {
      checks.push({ id: 'JAVA_BYTECODE_PRESENT', status: 'FAIL', message: 'Bytecode .class nao encontrado.' });
    }

    if (entries.some((e) => e.toLowerCase().endsWith('.war')) || artifactPath.toLowerCase().endsWith('.war')) {
      const missing = checkWarStructure(entries);
      checks.push(
        missing.length
          ? { id: 'JAVA_WAR_STRUCTURE', status: 'WARN', message: `Estrutura WAR incompleta: ${missing.join(', ')}` }
          : { id: 'JAVA_WAR_STRUCTURE', status: 'PASS' }
      );
    }

    // debug via javap when possible on a temp extracted class — best effort
    const classEntry = entries.find((e) => e.toLowerCase().endsWith('.class'));
    if (classEntry) {
      checks.push({
        id: 'JAVA_DEBUG_INFORMATION',
        status: 'WARN',
        message:
          'Debug line information nao verificada automaticamente neste artifact (use javap localmente se necessario). Veracode analisa sem debug, com menor precisao de linha.'
      });
    } else {
      // try jar listing only
      const javap = spawnSync('javap', ['-version'], { encoding: 'utf8' });
      if (javap.status === 0) {
        checks.push({
          id: 'JAVA_DEBUG_INFORMATION',
          status: 'WARN',
          message: 'Nao foi possivel amostrar .class para confirmar LineNumberTable/SourceFile.'
        });
      } else {
        checks.push({
          id: 'JAVA_DEBUG_INFORMATION',
          status: 'WARN',
          message: 'javap indisponivel; debug symbols nao confirmados.'
        });
      }
    }

    checks.push({
      id: 'JAVA_OBFUSCATION',
      status: 'WARN',
      message: 'Unable to reliably determine whether Java bytecode is obfuscated.'
    });
  }

  const status = finalizeStatus(checks);
  return {
    status,
    language: 'java',
    artifact: path.basename(artifactPath),
    checks,
    warnings: checks.filter((c) => c.status === 'WARN').map((c) => c.message || c.id),
    disclaimer:
      'Veracode-ready according to documented packaging requirements. Este Doctor nao reproduz o prescan proprietario da Veracode.'
  };
}

module.exports = { doctorJava };
