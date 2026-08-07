'use strict';

const path = require('path');
const { listZipEntries, finalizeStatus, genericChecks } = require('../common');

function doctorDotnet(artifactPath, plan = {}) {
  const checks = [...genericChecks(artifactPath)];
  if (checks.some((c) => c.status === 'FAIL')) {
    return { status: finalizeStatus(checks), checks, language: 'dotnet', artifact: artifactPath };
  }

  let entries = [];
  try {
    entries = listZipEntries(artifactPath).map((e) => e.replace(/\\/g, '/'));
  } catch (err) {
    checks.push({ id: 'DOTNET_ARCHIVE', status: 'FAIL', message: err.message });
    return { status: 'INVALID', checks, language: 'dotnet', artifact: artifactPath };
  }

  const lower = entries.map((e) => e.toLowerCase());
  const assemblies = lower.filter((e) => e.endsWith('.dll') || e.endsWith('.exe'));
  const pdbs = lower.filter((e) => e.endsWith('.pdb'));
  const deps = lower.filter(
    (e) => e.endsWith('.deps.json') || e.endsWith('project.assets.json') || e.includes('project.assets.json')
  );
  const tests = assemblies.filter((e) => /(\.|_)(tests?|specs?)\.(dll|exe)$/.test(e));
  const scdHints = lower.filter((e) => /hostfxr|coreclr\.dll$|createdump/.test(path.posix.basename(e)));

  checks.push(
    assemblies.length > 0
      ? { id: 'DOTNET_ASSEMBLY_PRESENT', status: 'PASS', message: `${assemblies.length} assemblies` }
      : { id: 'DOTNET_ASSEMBLY_PRESENT', status: 'FAIL', message: 'Nenhuma DLL/EXE encontrada.' }
  );

  checks.push(
    pdbs.length > 0
      ? { id: 'DOTNET_PDB_RECOMMENDED', status: 'PASS' }
      : {
          id: 'DOTNET_PDB_RECOMMENDED',
          status: 'WARN',
          message: 'PDB ausente. Recomendado para filenames/line numbers.'
        }
  );

  const modern =
    (plan.framework || '').includes('modern') ||
    (plan.framework || '').includes('aspnet-core') ||
    plan.buildSystem === 'dotnet';
  if (modern && plan.framework !== 'blazor-wasm') {
    checks.push(
      deps.length > 0
        ? { id: 'DOTNET_DEPS_JSON', status: 'PASS' }
        : {
            id: 'DOTNET_DEPS_JSON',
            status: 'WARN',
            message: 'deps.json / project.assets.json ausente; SCA pode ficar limitado.'
          }
    );
  }

  if (plan.framework === 'blazor-wasm') {
    checks.push({
      id: 'DOTNET_DEPS_JSON',
      status: 'WARN',
      message: 'Blazor WASM tipicamente nao gera deps.json; SCA agent recomendado pela Veracode.'
    });
  }

  checks.push(
    tests.length === 0
      ? { id: 'DOTNET_NO_TEST_ASSEMBLIES', status: 'PASS' }
      : {
          id: 'DOTNET_NO_TEST_ASSEMBLIES',
          status: 'WARN',
          message: `Possiveis test assemblies incluidos: ${tests.slice(0, 5).join(', ')}`
        }
  );

  checks.push(
    scdHints.length === 0
      ? { id: 'DOTNET_NO_SCD', status: 'PASS' }
      : {
          id: 'DOTNET_NO_SCD',
          status: 'FAIL',
          message: 'Indicadores de Self-Contained Deployment encontrados.'
        }
  );

  if (plan.framework === 'aspnet') {
    const aspx = lower.filter((e) => e.endsWith('.aspx'));
    // If many aspx and few dlls related — warn
    if (aspx.length > 0 && assemblies.length === 0) {
      checks.push({
        id: 'ASPNET_PRECOMPILED',
        status: 'FAIL',
        message: 'ASPX presentes sem assemblies — forms precisam estar pre-compiladas.'
      });
    } else {
      checks.push({ id: 'ASPNET_PRECOMPILED', status: 'PASS' });
    }
    if (lower.some((e) => e.includes('/roslyn/') || e.endsWith('/roslyn') || e.includes('\\roslyn\\'))) {
      checks.push({
        id: 'ASPNET_ROSLYN',
        status: 'WARN',
        message: 'Diretorio roslyn presente; a Veracode recomenda remocao.'
      });
    }
  }

  const status = finalizeStatus(checks);
  return {
    status,
    language: 'dotnet',
    artifact: path.basename(artifactPath),
    checks,
    warnings: checks.filter((c) => c.status === 'WARN').map((c) => c.message || c.id),
    disclaimer:
      'Veracode-ready according to documented packaging requirements. Este Doctor nao reproduz o prescan proprietario da Veracode.'
  };
}

module.exports = { doctorDotnet };
