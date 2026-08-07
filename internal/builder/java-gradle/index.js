'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const { resolveArtifactPatterns, createZip } = require('../../utils/artifact/artifact');
const { setOutputs, readJson, envStr, envBool, ensureDir, timingNow, timingMs } = require('../../utils/common/io');
const { fail, ERROR_CODES, classifyDependencyError, logCaughtError } = require('../../utils/errors/errors');
const { sanitizeText, sanitizeCommand, registerSecretsFromEnv } = require('../../utils/sanitize/sanitize');

const INIT_SCRIPT = `
allprojects {
  tasks.withType(JavaCompile).configureEach {
    options.debug = true
    options.debugOptions.debugLevel = 'source,lines,vars'
  }
}
`;

/**
 * Cria init script temporario, executa fn(initFile) e remove o arquivo no finally.
 * Nao altera arquivos do projeto — so aplica debug via --init-script.
 */
function withGradleInitScript(fn) {
  const initFile = path.join(os.tmpdir(), `veracode-gradle-init-${Date.now()}.gradle`);
  fs.writeFileSync(initFile, INIT_SCRIPT, { encoding: 'utf8', mode: 0o600 });
  try {
    return fn(initFile);
  } finally {
    try {
      fs.unlinkSync(initFile);
    } catch {
      /* ignore */
    }
  }
}

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

function main() {
  registerSecretsFromEnv();
  const start = timingNow();
  const plan = readJson(envStr('BUILD_PLAN_PATH', '.veracode-build/build-plan.json'));
  const source = path.resolve(envStr('SOURCE', '.'));
  const projectPath = path.resolve(source, plan.projectPath || '.');
  const outputDir = path.resolve(envStr('OUTPUT_DIR', '.veracode-build'));
  const artifactName = envStr('ARTIFACT_NAME', 'analysisPack.zip');
  const useWrapper = envBool('USE_WRAPPER', true);
  const runTests = envBool('RUN_TESTS', false) || plan.runTests;
  const restore = envBool('RESTORE_DEPENDENCIES', true);

  ensureDir(outputDir);

  const hasWrapper =
    fs.existsSync(path.join(projectPath, 'gradlew')) || fs.existsSync(path.join(projectPath, 'gradlew.bat'));
  let gradle = 'gradle';
  if (useWrapper && hasWrapper) {
    gradle =
      process.platform === 'win32' && fs.existsSync(path.join(projectPath, 'gradlew.bat'))
        ? 'gradlew.bat'
        : './gradlew';
    if (process.platform !== 'win32' && fs.existsSync(path.join(projectPath, 'gradlew'))) {
      try {
        fs.chmodSync(path.join(projectPath, 'gradlew'), 0o755);
      } catch {
        /* ignore */
      }
    }
  }

  withGradleInitScript((initFile) => {
    runHook(envStr('PRE_RESTORE_COMMAND'), projectPath);
    if (restore) {
      try {
        const restoreCmd = envStr('RESTORE_COMMAND', '');
        if (restoreCmd) runHook(restoreCmd, projectPath);
        else
          run(gradle, ['--init-script', initFile, 'dependencies', '-q'], {
            cwd: projectPath,
            shell: process.platform === 'win32'
          });
      } catch (err) {
        const code = classifyDependencyError(err.output || err.message) || ERROR_CODES.DEPENDENCY_RESTORE_FAILED;
        fail(code, 'Falha no restore Gradle.', { stage: 'Dependency Restore' });
      }
    }
    runHook(envStr('POST_RESTORE_COMMAND'), projectPath);

    runHook(envStr('PRE_BUILD_COMMAND'), projectPath);
    try {
      const buildCmd = envStr('BUILD_COMMAND', '');
      if (buildCmd) runHook(buildCmd, projectPath);
      else {
        const args = ['--init-script', initFile, 'assemble'];
        if (!runTests) args.push('-x', 'test');
        run(gradle, args, { cwd: projectPath, shell: process.platform === 'win32' });
      }
    } catch (err) {
      fail(ERROR_CODES.BUILD_FAILED, 'Build Gradle falhou.', {
        stage: 'Builder',
        detected: sanitizeText((err.output || err.message || '').slice(-1500))
      });
    }
    runHook(envStr('POST_BUILD_COMMAND'), projectPath);

    const patterns = plan.artifact?.patterns || ['build/libs/*.jar', 'build/libs/*.war'];
    const files = resolveArtifactPatterns(projectPath, patterns);
    if (files.length === 0) {
      fail(ERROR_CODES.ARTIFACT_NOT_FOUND, 'Nenhum JAR/WAR encontrado apos o build Gradle.', {
        stage: 'Packaging'
      });
    }

    const outZip = path.join(outputDir, artifactName);
    createZip(files, outZip);
    const elapsed = timingMs(start) / 1000;
    setOutputs({
      restore_status: restore ? 'success' : 'skipped',
      build_status: 'success',
      artifact_path: outZip,
      artifact_name: artifactName,
      artifact_status: 'ready',
      builder_seconds: elapsed.toFixed(3)
    });
    console.log(`Gradle builder: ${elapsed.toFixed(1)}s`);
  });
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    logCaughtError(err);
    process.exit(1);
  }
}

module.exports = { main, withGradleInitScript, INIT_SCRIPT };
