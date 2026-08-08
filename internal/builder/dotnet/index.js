'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { zipDirectoryContents } = require('../../utils/artifact/artifact');
const { setOutputs, readJson, envStr, envBool, ensureDir, timingNow, timingMs } = require('../../utils/common/io');
const { fail, ERROR_CODES, classifyDependencyError, logCaughtError } = require('../../utils/errors/errors');
const { sanitizeText, sanitizeCommand, registerSecretsFromEnv } = require('../../utils/sanitize/sanitize');

function run(cmd, args, opts = {}) {
  console.log(sanitizeCommand(cmd, args));
  const res = spawnSync(cmd, args, {
    cwd: opts.cwd,
    env: opts.env || process.env,
    encoding: 'utf8',
    shell: opts.shell || false
  });
  const out = sanitizeText(`${res.stdout || ''}\n${res.stderr || ''}`);
  if (res.status !== 0) {
    const err = new Error(sanitizeText(out.slice(-4000) || `exit ${res.status}`));
    err.output = out;
    throw err;
  }
  return out;
}

function runHook(command, cwd) {
  if (!command || !String(command).trim()) return;
  const isWin = process.platform === 'win32';
  run(isWin ? 'cmd.exe' : 'bash', isWin ? ['/d', '/s', '/c', command] : ['-lc', command], { cwd });
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

function filterOutTests(files, testProjects) {
  const testNames = new Set((testProjects || []).map((t) => path.basename(t, path.extname(t)).toLowerCase()));
  return files.filter((f) => {
    const base = path.basename(f).toLowerCase();
    if (/(\.|_)(tests?|specs?)\.dll$/i.test(base)) return false;
    for (const tn of testNames) {
      if (base.startsWith(tn.toLowerCase()) && base.endsWith('.dll')) return false;
    }
    return true;
  });
}

function main() {
  registerSecretsFromEnv();
  const start = timingNow();
  const plan = readJson(envStr('BUILD_PLAN_PATH', '.veracode-build/build-plan.json'));
  const source = path.resolve(envStr('SOURCE', '.'));
  const projectPath = path.resolve(source, plan.projectPath || '.');
  const outputDir = path.resolve(envStr('OUTPUT_DIR', '.veracode-build'));
  const artifactName = envStr('ARTIFACT_NAME', 'analysisPack.zip');
  const restore = envBool('RESTORE_DEPENDENCIES', true);
  const family = plan.framework || plan.projectType || 'dotnet-modern';
  const publishDir = path.join(outputDir, 'dotnet-out');

  ensureDir(outputDir);
  ensureDir(publishDir);

  const needsWindows = (plan.runnerRequirements?.os || []).length === 1 && plan.runnerRequirements.os[0] === 'windows';
  if (needsWindows && process.platform !== 'win32') {
    fail(ERROR_CODES.RUNNER_OS_INCOMPATIBLE, 'Projeto .NET Framework/ASP.NET classico requer runner Windows.', {
      stage: 'Environment',
      detected: `os=${process.platform}, family=${family}`,
      howToFix: 'Execute o workflow em windows-latest ou runner Windows self-hosted.'
    });
  }

  const projectArg = fs.existsSync(projectPath) ? projectPath : source;

  runHook(envStr('PRE_RESTORE_COMMAND'), source);
  if (restore) {
    try {
      const restoreCmd = envStr('RESTORE_COMMAND', '');
      if (restoreCmd) runHook(restoreCmd, source);
      else if (family === 'dotnet-framework' || family === 'aspnet') {
        // nuget/msbuild restore best-effort
        run('dotnet', ['restore', projectArg], { cwd: source, shell: process.platform === 'win32' });
      } else {
        run('dotnet', ['restore', projectArg], { cwd: source, shell: process.platform === 'win32' });
      }
    } catch (err) {
      const code = classifyDependencyError(err.output || err.message) || ERROR_CODES.DEPENDENCY_RESTORE_FAILED;
      fail(code, 'Falha no restore NuGet/dotnet.', {
        stage: 'Dependency Restore',
        howToFix: 'Configure NUGET_TOKEN (ou credenciais do feed) via env secrets.'
      });
    }
  }
  runHook(envStr('POST_RESTORE_COMMAND'), source);

  runHook(envStr('PRE_BUILD_COMMAND'), source);
  try {
    const buildCmd = envStr('BUILD_COMMAND', '');
    if (buildCmd) {
      runHook(buildCmd, source);
    } else if (family === 'blazor-wasm') {
      run(
        'dotnet',
        [
          'build',
          projectArg,
          '-c',
          'Debug',
          '-p:UseAppHost=false',
          `-p:SatelliteResourceLanguages=en`,
          '-p:BlazorEnableCompression=false',
          '-o',
          publishDir
        ],
        { cwd: source, shell: process.platform === 'win32' }
      );
    } else if (family === 'aspnet' || family === 'dotnet-framework') {
      const msbuildArgs = [
        projectArg,
        '/t:Rebuild',
        '/p:Configuration=Debug',
        '/p:DebugSymbols=true',
        '/p:PrecompileBeforePublish=true',
        '/p:EnableUpdateable=false',
        `/p:OutputPath=${publishDir}`
      ];
      try {
        run('msbuild', msbuildArgs, { cwd: source, shell: true });
      } catch {
        run('dotnet', ['msbuild', ...msbuildArgs], { cwd: source, shell: process.platform === 'win32' });
      }
      // Remove roslyn if present (Veracode recommendation)
      const roslyn = path.join(publishDir, 'roslyn');
      if (fs.existsSync(roslyn)) {
        fs.rmSync(roslyn, { recursive: true, force: true });
        console.log('Diretorio roslyn removido conforme recomendacao Veracode.');
      }
    } else {
      // modern FDD publish
      run('dotnet', ['publish', projectArg, '-c', 'Debug', '-o', publishDir, '-p:UseAppHost=false'], {
        cwd: source,
        shell: process.platform === 'win32'
      });
    }
  } catch (err) {
    fail(ERROR_CODES.BUILD_FAILED, 'Build .NET falhou.', {
      stage: 'Builder',
      detected: sanitizeText((err.output || err.message || '').slice(-1500))
    });
  }
  runHook(envStr('POST_BUILD_COMMAND'), source);

  // Preserve project.assets.json when available
  const assetsCandidates = walk(source).filter((f) => path.basename(f) === 'project.assets.json');
  for (const assets of assetsCandidates.slice(0, 3)) {
    const dest = path.join(publishDir, path.basename(path.dirname(assets)) + '.project.assets.json');
    try {
      fs.copyFileSync(assets, dest);
    } catch {
      /* ignore */
    }
  }

  let files = walk(publishDir).filter((f) => /\.(dll|exe|pdb|json)$/i.test(f));
  files = filterOutTests(files, plan.testProjects);

  // Detect SCD heuristic
  if (files.some((f) => /hostfxr|coreclr/i.test(path.basename(f)))) {
    console.log(
      '::warning::Possivel Self-Contained Deployment detectado. A Veracode nao suporta SCD para Static Analysis.'
    );
  }

  if (files.length === 0) {
    fail(ERROR_CODES.ARTIFACT_NOT_FOUND, 'Nenhum assembly .NET encontrado no output.', {
      stage: 'Packaging'
    });
  }

  const outZip = path.join(outputDir, artifactName);
  zipDirectoryContents(publishDir, outZip, {
    excludeNames: ['roslyn']
  });

  const elapsed = timingMs(start) / 1000;
  setOutputs({
    restore_status: restore ? 'success' : 'skipped',
    build_status: 'success',
    artifact_path: outZip,
    artifact_name: artifactName,
    artifact_status: 'ready',
    builder_seconds: elapsed.toFixed(3)
  });
  console.log(`.NET builder (${family}): ${elapsed.toFixed(1)}s`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    logCaughtError(err);
    process.exit(1);
  }
}

module.exports = { main };
