'use strict';

/**
 * Roda Discovery → Builder → asserts outputs/artifact para um fixture de integration.
 *
 * Uso:
 *   node scripts/run-integration-fixture.js \
 *     --source tests/fixtures/integration/java/maven/java17-basic \
 *     --expect-language java \
 *     --expect-build-system maven \
 *     --expect-runtime 17 \
 *     --builder java-maven \
 *     --expect-zip-entry '.class'
 *
 * Env extras (JDK/dotnet/node) devem estar no PATH antes da chamada.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { execFileSync } = require('child_process');

function arg(name, fallback = '') {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function runNode(script, env) {
  const res = spawnSync(process.execPath, [script], {
    env: { ...process.env, ...env },
    encoding: 'utf8'
  });
  if (res.status !== 0) {
    console.error(res.stdout || '');
    console.error(res.stderr || '');
    throw new Error(`${script} failed with exit ${res.status}`);
  }
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
}

function listZip(zipPath) {
  if (process.platform === 'win32') {
    const ps = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::OpenRead('${zipPath.replace(/'/g, "''")}').Entries | ForEach-Object { $_.FullName }
`;
    return execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { encoding: 'utf8' })
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' })
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`::error::ASSERT: ${msg}`);
    process.exit(1);
  }
}

function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const sourceRel = arg('source');
  assert(sourceRel, '--source is required');
  const source = path.resolve(repoRoot, sourceRel);
  assert(fs.existsSync(source), `source not found: ${source}`);

  const expectLanguage = arg('expect-language');
  const expectBuildSystem = arg('expect-build-system');
  const expectRuntime = arg('expect-runtime');
  const expectStrategy = arg('expect-strategy', '');
  const builder = arg('builder'); // java-maven | java-gradle | javascript | dotnet
  const expectZipEntry = arg('expect-zip-entry', '');
  const forbidZipEntry = arg('forbid-zip-entry', '');
  const projectPath = arg('project-path', '.');
  const skipBuilder = hasFlag('skip-builder');
  const skipDoctor = hasFlag('skip-doctor');

  const outDir = path.resolve(repoRoot, arg('output-dir', `.veracode-build-int/${path.basename(source)}`));
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const baseEnv = {
    SOURCE: source,
    PROJECT_PATH: projectPath,
    OUTPUT_DIR: outDir,
    CONFIG_MODE: 'disabled',
    ARTIFACT_NAME: 'analysisPack.zip',
    RESTORE_DEPENDENCIES: 'true',
    RUN_TESTS: 'false',
    USE_WRAPPER: 'true',
    DOCTOR_MODE: 'standard'
  };

  console.log(`== Discovery: ${sourceRel}`);
  runNode(path.join(repoRoot, 'internal/discovery/index.js'), baseEnv);

  const plan = JSON.parse(fs.readFileSync(path.join(outDir, 'build-plan.json'), 'utf8'));
  const discovery = JSON.parse(fs.readFileSync(path.join(outDir, 'discovery-result.json'), 'utf8'));

  console.log(
    `discovered language=${plan.language} buildSystem=${plan.buildSystem} runtime=${plan.runtimeVersion} strategy=${plan.strategy}`
  );

  if (expectLanguage)
    assert(plan.language === expectLanguage, `language expected ${expectLanguage}, got ${plan.language}`);
  if (expectBuildSystem) {
    assert(
      plan.buildSystem === expectBuildSystem,
      `build_system expected ${expectBuildSystem}, got ${plan.buildSystem}`
    );
  }
  if (expectRuntime) {
    const rt = String(plan.runtimeVersion || '');
    assert(
      rt === expectRuntime ||
        rt.includes(expectRuntime) ||
        (discovery.targetFrameworks || []).some((t) => String(t).includes(expectRuntime)),
      `runtime_version expected to include ${expectRuntime}, got ${rt}`
    );
  }
  if (expectStrategy) {
    assert(plan.strategy === expectStrategy, `strategy expected ${expectStrategy}, got ${plan.strategy}`);
  }

  if (skipBuilder) {
    console.log('== skip builder');
    return;
  }

  assert(builder, '--builder is required unless --skip-builder');
  const builderMap = {
    'java-maven': 'internal/builder/java-maven/index.js',
    'java-gradle': 'internal/builder/java-gradle/index.js',
    javascript: 'internal/builder/javascript/index.js',
    dotnet: 'internal/builder/dotnet/index.js'
  };
  assert(builderMap[builder], `unknown builder ${builder}`);

  console.log(`== Builder: ${builder}`);
  runNode(path.join(repoRoot, builderMap[builder]), {
    ...baseEnv,
    BUILD_PLAN_PATH: path.join(outDir, 'build-plan.json')
  });

  const artifactPath = path.join(outDir, 'analysisPack.zip');
  assert(fs.existsSync(artifactPath), `artifact missing: ${artifactPath}`);
  assert(fs.statSync(artifactPath).size > 0, 'artifact is empty');
  console.log(`artifact_path=${artifactPath} size=${fs.statSync(artifactPath).size}`);

  const entries = listZip(artifactPath);
  assert(entries.length > 0, 'artifact has no entries');
  console.log(`artifact entries=${entries.length}`);

  if (expectZipEntry) {
    const re = new RegExp(expectZipEntry.replace(/\./g, '\\.').replace(/\*/g, '.*'), 'i');
    assert(
      entries.some((e) => re.test(e) || e.toLowerCase().includes(expectZipEntry.toLowerCase())),
      `expected zip entry matching ${expectZipEntry}, got: ${entries.slice(0, 20).join(', ')}`
    );
  }
  if (forbidZipEntry) {
    assert(
      !entries.some((e) => e.toLowerCase().includes(forbidZipEntry.toLowerCase())),
      `forbidden zip entry present: ${forbidZipEntry}`
    );
  }

  if (!skipDoctor) {
    console.log('== Doctor');
    runNode(path.join(repoRoot, 'internal/doctor/index.js'), {
      ...baseEnv,
      ARTIFACT_PATH: artifactPath,
      BUILD_PLAN_PATH: path.join(outDir, 'build-plan.json'),
      DOCTOR_PROFILE: plan.doctorProfile || ''
    });
    const doctor = JSON.parse(fs.readFileSync(path.join(outDir, 'doctor-result.json'), 'utf8'));
    assert(doctor.status === 'READY' || doctor.status === 'READY_WITH_WARNINGS', `doctor status=${doctor.status}`);
    console.log(`doctor_status=${doctor.status}`);
  }

  console.log('== PASS');
}

main();
