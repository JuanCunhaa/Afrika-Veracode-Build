'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { resolveArtifactPatterns, createZip } = require('../../utils/artifact/artifact');
const { setOutputs, readJson, envStr, envBool, ensureDir, timingNow, timingMs } = require('../../utils/common/io');
const { fail, ERROR_CODES, classifyDependencyError } = require('../../utils/errors/errors');
const { sanitizeLog } = require('../../utils/sanitize/sanitize');

function run(cmd, args, opts = {}) {
  console.log(`$ ${cmd} ${args.join(' ')}`);
  const res = spawnSync(cmd, args, {
    cwd: opts.cwd,
    env: opts.env || process.env,
    encoding: 'utf8',
    shell: opts.shell || false
  });
  const out = `${res.stdout || ''}\n${res.stderr || ''}`;
  if (res.status !== 0) {
    const err = new Error(sanitizeLog(out.slice(-4000) || `exit ${res.status}`));
    err.output = out;
    err.status = res.status;
    throw err;
  }
  return out;
}

function runHook(command, cwd) {
  if (!command || !String(command).trim()) return;
  const isWin = process.platform === 'win32';
  run(isWin ? 'cmd.exe' : 'bash', isWin ? ['/d', '/s', '/c', command] : ['-lc', command], {
    cwd,
    shell: false
  });
}

function main() {
  const start = timingNow();
  const planPath = envStr('BUILD_PLAN_PATH', '.veracode-build/build-plan.json');
  const plan = readJson(planPath);
  const source = path.resolve(envStr('SOURCE', '.'));
  const projectPath = path.resolve(source, plan.projectPath || '.');
  const outputDir = path.resolve(envStr('OUTPUT_DIR', '.veracode-build'));
  const artifactName = envStr('ARTIFACT_NAME', 'analysisPack.zip');
  const useWrapper = envBool('USE_WRAPPER', true);
  const runTests = envBool('RUN_TESTS', false) || plan.runTests;
  const restore = envBool('RESTORE_DEPENDENCIES', true);

  ensureDir(outputDir);

  const hasWrapper = fs.existsSync(path.join(projectPath, 'mvnw')) || fs.existsSync(path.join(projectPath, 'mvnw.cmd'));
  let mvn = 'mvn';
  if (useWrapper && hasWrapper) {
    mvn = process.platform === 'win32' && fs.existsSync(path.join(projectPath, 'mvnw.cmd')) ? 'mvnw.cmd' : './mvnw';
    if (process.platform !== 'win32' && fs.existsSync(path.join(projectPath, 'mvnw'))) {
      try {
        fs.chmodSync(path.join(projectPath, 'mvnw'), 0o755);
      } catch {
        /* ignore */
      }
    }
  }

  runHook(envStr('PRE_RESTORE_COMMAND'), projectPath);

  if (restore) {
    try {
      const restoreCmd = envStr('RESTORE_COMMAND', '');
      if (restoreCmd) {
        runHook(restoreCmd, projectPath);
      } else {
        run(mvn, ['-B', 'dependency:resolve', '-DskipTests'], {
          cwd: projectPath,
          shell: process.platform === 'win32'
        });
      }
    } catch (err) {
      const code = classifyDependencyError(err.output || err.message) || ERROR_CODES.DEPENDENCY_RESTORE_FAILED;
      fail(code, 'Falha no restore de dependencias Maven.', {
        stage: 'Dependency Restore',
        howToFix: 'Verifique registries privados e variaveis MAVEN_USERNAME/MAVEN_PASSWORD/MAVEN_TOKEN via env.'
      });
    }
  }
  runHook(envStr('POST_RESTORE_COMMAND'), projectPath);

  runHook(envStr('PRE_BUILD_COMMAND'), projectPath);
  try {
    const buildCmd = envStr('BUILD_COMMAND', '');
    if (buildCmd) {
      runHook(buildCmd, projectPath);
    } else {
      const args = ['-B', 'package', `-Dmaven.compiler.debug=true`, `-Dmaven.compiler.debuglevel=lines,vars,source`];
      if (!runTests) args.push('-DskipTests');
      run(mvn, args, { cwd: projectPath, shell: process.platform === 'win32' });
    }
  } catch (err) {
    fail(ERROR_CODES.BUILD_FAILED, 'Build Maven falhou.', {
      stage: 'Builder',
      detected: sanitizeLog((err.output || err.message || '').slice(-1500)),
      howToFix: 'Corrija erros de compilacao. Nao ha fallback silencioso para Java Source Scan.'
    });
  }
  runHook(envStr('POST_BUILD_COMMAND'), projectPath);

  const patterns = plan.artifact?.patterns || ['target/*.jar', 'target/*.war', 'target/*.ear'];
  const files = resolveArtifactPatterns(projectPath, patterns);
  if (files.length === 0) {
    fail(ERROR_CODES.ARTIFACT_NOT_FOUND, 'Nenhum JAR/WAR/EAR encontrado apos o build Maven.', {
      stage: 'Packaging',
      requirement: patterns.join(', ')
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
    builder_seconds: elapsed.toFixed(3),
    collected_artifacts: JSON.stringify(files)
  });
  console.log(`Maven builder: ${elapsed.toFixed(1)}s — ${files.length} artifact(s)`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(`::error::${err.message || err}`);
    process.exit(1);
  }
}

module.exports = { main };
