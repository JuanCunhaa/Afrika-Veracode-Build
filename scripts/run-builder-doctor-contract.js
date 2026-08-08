'use strict';

/**
 * Builder → Doctor Contract Tests
 *
 * Pipeline: Fixture → Discovery → BuildPlan → Builder → Artifact → Doctor
 * Regra: se Builder.status === success e strategy suportada → Doctor MUST NOT return INVALID
 * Violacao → BUILDER_DOCTOR_CONTRACT_BROKEN
 *
 * Uso (CI / um caso):
 *   node scripts/run-builder-doctor-contract.js \
 *     --source tests/fixtures/integration/java/maven/java17-basic \
 *     --expect-language java \
 *     --builder java-maven \
 *     --family java-maven
 *
 * Uso (familia / resumo):
 *   node scripts/run-builder-doctor-contract.js --family java-maven
 *   node scripts/run-builder-doctor-contract.js --all
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const {
  listZip,
  assertDoctorAcceptsBuilderArtifact,
  hasEntry,
  probeJavaDebug,
  ERROR_CODES
} = require('../tests/contract/builder-doctor/lib/contract');

function arg(name, fallback = '') {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`::error::ASSERT: ${msg}`);
    process.exit(1);
  }
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

function fileHash(p) {
  if (!fs.existsSync(p)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function loadFamilyCases(repoRoot, family) {
  const p = path.join(repoRoot, 'tests/contract/builder-doctor', family, 'cases.json');
  assert(fs.existsSync(p), `cases not found: ${p}`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function matchZip(entries, pattern) {
  const re = new RegExp(String(pattern).replace(/\./g, '\\.').replace(/\*/g, '.*'), 'i');
  return entries.some((e) => re.test(e) || e.toLowerCase().includes(String(pattern).toLowerCase()));
}

function assertArtifactShape(caseDef, entries) {
  const expect = caseDef.expectZipEntries || [];
  for (const pat of expect) {
    // OR patterns: ".class|.jar|.war"
    const alts = String(pat).split('|');
    assert(
      alts.some((a) => matchZip(entries, a.trim())),
      `expected zip entry matching ${pat}, sample: ${entries.slice(0, 25).join(', ')}`
    );
  }
  for (const pat of caseDef.forbidZipEntries || []) {
    assert(!matchZip(entries, pat), `forbidden zip entry present: ${pat}`);
  }
  if (caseDef.requireFirstPartyBytecode) {
    assert(
      entries.some((e) => /\.(class|jar|war)$/i.test(e)),
      'first-party bytecode container (.class/.jar/.war) ausente'
    );
  }
  if (caseDef.requireDll) {
    assert(
      entries.some((e) => /\.dll$/i.test(e)),
      'DLL ausente no artifact'
    );
  }
  if (caseDef.requirePdbInZip) {
    assert(
      entries.some((e) => /\.pdb$/i.test(e)),
      'PDB ausente (Builder Debug deveria produzir)'
    );
  }
  if (caseDef.requireDepsJson) {
    assert(
      entries.some((e) => /deps\.json$/i.test(e)),
      'deps.json ausente'
    );
  }
  if (caseDef.forbidTestAssemblies) {
    const bad = entries.filter((e) => /(^|\/)(.*\.)?(tests?|xunit|nunit|mstest)[^/]*\.dll$/i.test(e));
    assert(bad.length === 0, `assemblies de teste no artifact: ${bad.join(', ')}`);
  }
  if (caseDef.requireTsSources) {
    assert(
      entries.some((e) => /\.tsx?$/i.test(e)),
      'TypeScript sources (.ts/.tsx) devem permanecer no artifact'
    );
  }
  if (caseDef.requirePackageJson) {
    assert(hasEntry(entries, 'package.json'), 'package.json ausente');
  }
  if (caseDef.requireLockfileWhenPresent && caseDef.lockfileName) {
    // lockfile presence in fixture → must be in zip
    assert(hasEntry(entries, caseDef.lockfileName), `lockfile ${caseDef.lockfileName} ausente no artifact`);
  }
}

function runCase(repoRoot, caseDef) {
  if (Array.isArray(caseDef.platforms) && caseDef.platforms.length > 0) {
    if (!caseDef.platforms.includes(process.platform)) {
      console.log(`== SKIP ${caseDef.id} (platform ${process.platform} not in ${caseDef.platforms.join(',')})`);
      return { id: caseDef.id, family: caseDef.family, status: 'PASS', skipped: true };
    }
  }

  const source = path.resolve(repoRoot, caseDef.source);
  assert(fs.existsSync(source), `source not found: ${source}`);

  const slug = caseDef.id || path.basename(source);
  const outDir = path.resolve(
    repoRoot,
    caseDef.outputDir || `.veracode-build-contract/${caseDef.family || 'case'}/${slug}`
  );
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const projectPath = caseDef.projectPath || '.';
  const builder = caseDef.builder;
  const builderMap = {
    'java-maven': 'internal/builder/java-maven/index.js',
    'java-gradle': 'internal/builder/java-gradle/index.js',
    javascript: 'internal/builder/javascript/index.js',
    dotnet: 'internal/builder/dotnet/index.js'
  };
  assert(builderMap[builder], `unknown builder ${builder}`);

  const gradleFiles = ['build.gradle', 'build.gradle.kts', 'settings.gradle', 'settings.gradle.kts']
    .map((f) => path.join(source, projectPath === '.' ? f : path.join(projectPath, f)))
    .filter((f) => fs.existsSync(f));
  const hashesBefore = Object.fromEntries(gradleFiles.map((f) => [f, fileHash(f)]));

  const baseEnv = {
    SOURCE: source,
    PROJECT_PATH: projectPath,
    OUTPUT_DIR: outDir,
    CONFIG_MODE: 'disabled',
    ARTIFACT_NAME: 'analysisPack.zip',
    RESTORE_DEPENDENCIES: 'true',
    RUN_TESTS: 'false',
    USE_WRAPPER: process.env.USE_WRAPPER || (caseDef.useWrapper === false ? 'false' : 'true'),
    DOCTOR_MODE: 'standard'
  };

  console.log(`\n== CONTRACT ${caseDef.family || ''}/${slug}`);
  console.log(`source=${caseDef.source}`);

  runNode(path.join(repoRoot, 'internal/discovery/index.js'), baseEnv);

  const plan = JSON.parse(fs.readFileSync(path.join(outDir, 'build-plan.json'), 'utf8'));
  const discovery = JSON.parse(fs.readFileSync(path.join(outDir, 'discovery-result.json'), 'utf8'));

  console.log(
    `discovery language=${plan.language} buildSystem=${plan.buildSystem} runtime=${plan.runtimeVersion} strategy=${plan.strategy}`
  );

  if (caseDef.expectLanguage) {
    assert(
      plan.language === caseDef.expectLanguage,
      `language expected ${caseDef.expectLanguage}, got ${plan.language}`
    );
  }
  if (caseDef.expectBuildSystem) {
    assert(
      plan.buildSystem === caseDef.expectBuildSystem,
      `build_system expected ${caseDef.expectBuildSystem}, got ${plan.buildSystem}`
    );
  }
  if (caseDef.expectRuntime) {
    const rt = String(plan.runtimeVersion || '');
    const ok =
      rt === caseDef.expectRuntime ||
      rt.includes(caseDef.expectRuntime) ||
      (discovery.targetFrameworks || []).some((t) => String(t).includes(caseDef.expectRuntime));
    assert(ok, `runtime expected ${caseDef.expectRuntime}, got ${rt}`);
  }
  if (caseDef.expectStrategy) {
    assert(
      plan.strategy === caseDef.expectStrategy,
      `strategy expected ${caseDef.expectStrategy}, got ${plan.strategy}`
    );
  }

  console.log(`== Builder: ${builder}`);
  runNode(path.join(repoRoot, builderMap[builder]), {
    ...baseEnv,
    BUILD_PLAN_PATH: path.join(outDir, 'build-plan.json')
  });

  // Gradle: projeto nao modificado; init removido
  if (caseDef.assertGradleInit || builder === 'java-gradle') {
    for (const [f, h] of Object.entries(hashesBefore)) {
      assert(fileHash(f) === h, `Gradle project file modificado permanentemente: ${f}`);
    }
    const tmp = require('os').tmpdir();
    const leftover = fs.readdirSync(tmp).filter((n) => n.startsWith('veracode-gradle-init-') && n.endsWith('.gradle'));
    // arquivos de corridas paralelas podem existir; garantimos que o nosso fluxo remove o da corrida via finally —
    // aqui so alertamos se houver muitos leftovers recentes (best-effort)
    if (leftover.length > 20) {
      console.log(`::warning::muitos init scripts leftover em tmp (${leftover.length})`);
    }
  }

  const artifactPath = path.join(outDir, 'analysisPack.zip');
  assert(fs.existsSync(artifactPath), `artifact missing: ${artifactPath}`);
  assert(fs.statSync(artifactPath).size > 0, 'artifact empty');

  const entries = listZip(artifactPath);
  assert(entries.length > 0, 'artifact has no entries');
  console.log(`artifact entries=${entries.length} size=${fs.statSync(artifactPath).size}`);

  assertArtifactShape(caseDef, entries);

  if (caseDef.probeJavaDebug) {
    const classEntry = entries.find((e) => e.endsWith('.class'));
    if (classEntry) {
      const probe = probeJavaDebug(artifactPath, classEntry);
      if (probe.ok) {
        assert(probe.hasLineNumberTable, 'LineNumberTable ausente (debug esperado)');
        assert(probe.hasSourceFile, 'SourceFile ausente (debug esperado)');
        console.log(
          `javap debug: LineNumberTable=${probe.hasLineNumberTable} SourceFile=${probe.hasSourceFile} LocalVariableTable=${!!probe.hasLocalVariableTable}`
        );
      } else {
        console.log(`javap probe skipped: ${probe.reason || 'n/a'} (bytecode ainda validado via Doctor)`);
      }
    } else {
      console.log('javap probe skipped: .class nao no zip externo (JAR/WAR container — Doctor cobre bytecode)');
    }
  }

  // Golden copy opcional (pequeno / deterministico path; nao commitado)
  if (caseDef.goldenDir) {
    const goldenRoot = path.resolve(repoRoot, caseDef.goldenDir);
    fs.mkdirSync(goldenRoot, { recursive: true });
    const goldenZip = path.join(goldenRoot, `${slug}-analysisPack.zip`);
    fs.copyFileSync(artifactPath, goldenZip);
    fs.writeFileSync(
      path.join(goldenRoot, `${slug}-entries.json`),
      JSON.stringify({ generatedAt: new Date().toISOString(), entries }, null, 2)
    );
  }

  console.log('== Doctor');
  runNode(path.join(repoRoot, 'internal/doctor/index.js'), {
    ...baseEnv,
    ARTIFACT_PATH: artifactPath,
    BUILD_PLAN_PATH: path.join(outDir, 'build-plan.json'),
    DOCTOR_PROFILE: plan.doctorProfile || ''
  });

  const doctor = JSON.parse(fs.readFileSync(path.join(outDir, 'doctor-result.json'), 'utf8'));
  console.log(`doctor_status=${doctor.status}`);

  const warns = (doctor.checks || []).filter((c) => c.status === 'WARN');
  if (warns.length) {
    console.log('doctor warnings (allowed when intentional):');
    for (const w of warns) {
      console.log(` - ${w.id}: ${w.message || ''}`);
    }
  }

  assertDoctorAcceptsBuilderArtifact({
    language: plan.language,
    runtime: plan.runtimeVersion,
    builder,
    artifact: artifactPath,
    doctor,
    requirePdb: !!caseDef.requirePdb
  });

  console.log(`build_status=success artifact_status=ready doctor_status=${doctor.status}`);
  console.log('== CONTRACT PASS');
  return { id: slug, family: caseDef.family, status: 'PASS', doctor: doctor.status };
}

function caseFromCli() {
  const source = arg('source');
  if (!source) return null;
  const family = arg('family', 'adhoc');
  return {
    id: path.basename(source),
    family,
    source,
    expectLanguage: arg('expect-language') || undefined,
    expectBuildSystem: arg('expect-build-system') || undefined,
    expectRuntime: arg('expect-runtime') || undefined,
    expectStrategy: arg('expect-strategy') || undefined,
    builder: arg('builder'),
    projectPath: arg('project-path', '.') || '.',
    expectZipEntries: arg('expect-zip-entry') ? [arg('expect-zip-entry')] : [],
    forbidZipEntries: arg('forbid-zip-entry') ? [arg('forbid-zip-entry')] : [],
    requirePdb: hasFlag('require-pdb'),
    requirePdbInZip: hasFlag('require-pdb-in-zip'),
    requireDll: hasFlag('require-dll'),
    requireDepsJson: hasFlag('require-deps-json'),
    forbidTestAssemblies: hasFlag('forbid-test-assemblies'),
    requireTsSources: hasFlag('require-ts-sources'),
    requirePackageJson: hasFlag('require-package-json'),
    requireFirstPartyBytecode: hasFlag('require-bytecode'),
    probeJavaDebug: hasFlag('probe-java-debug'),
    assertGradleInit: hasFlag('assert-gradle-init'),
    useWrapper: arg('use-wrapper', '') === 'false' ? false : undefined,
    goldenDir: arg('golden-dir', '') || undefined
  };
}

function printSummary(results) {
  const byFamily = {};
  for (const r of results) {
    const f = r.family || 'other';
    if (!byFamily[f]) byFamily[f] = { pass: 0, fail: 0, total: 0 };
    byFamily[f].total += 1;
    if (r.status === 'PASS') byFamily[f].pass += 1;
    else byFamily[f].fail += 1;
  }

  console.log('\n========================================');
  console.log('Builder → Doctor Contract');
  console.log('========================================');
  const order = ['java-maven', 'java-gradle', 'javascript', 'typescript', 'dotnet'];
  for (const f of order) {
    if (!byFamily[f]) continue;
    const s = byFamily[f];
    console.log(`${labelFamily(f)}: PASS ${s.pass}/${s.total}`);
  }
  for (const f of Object.keys(byFamily)) {
    if (order.includes(f)) continue;
    const s = byFamily[f];
    console.log(`${f}: PASS ${s.pass}/${s.total}`);
  }
  const violations = results.filter((r) => r.status !== 'PASS' || r.contractBroken).length;
  console.log(`Contract violations: ${violations}`);
  console.log('========================================\n');
}

function labelFamily(f) {
  const map = {
    'java-maven': 'Java Maven',
    'java-gradle': 'Java Gradle',
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    dotnet: '.NET'
  };
  return map[f] || f;
}

function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const results = [];

  if (hasFlag('all')) {
    const families = ['java-maven', 'java-gradle', 'javascript', 'typescript', 'dotnet'];
    for (const family of families) {
      const cases = loadFamilyCases(repoRoot, family);
      for (const c of cases) {
        try {
          results.push(runCase(repoRoot, { ...c, family }));
        } catch (err) {
          const broken = err.code === ERROR_CODES.BUILDER_DOCTOR_CONTRACT_BROKEN;
          results.push({ id: c.id, family, status: 'FAIL', contractBroken: broken, error: err.message });
          console.error(err.message || err);
          if (!hasFlag('keep-going')) {
            printSummary(results);
            process.exit(1);
          }
        }
      }
    }
    printSummary(results);
    if (results.some((r) => r.status !== 'PASS')) process.exit(1);
    return;
  }

  const family = arg('family', '');
  const onlyId = arg('case', '');

  if (family && !arg('source')) {
    const cases = loadFamilyCases(repoRoot, family).filter((c) => !onlyId || c.id === onlyId);
    for (const c of cases) {
      try {
        results.push(runCase(repoRoot, { ...c, family }));
      } catch (err) {
        const broken = err.code === ERROR_CODES.BUILDER_DOCTOR_CONTRACT_BROKEN;
        results.push({ id: c.id, family, status: 'FAIL', contractBroken: broken, error: err.message });
        console.error(err.message || err);
        printSummary(results);
        process.exit(1);
      }
    }
    printSummary(results);
    return;
  }

  const cliCase = caseFromCli();
  assert(cliCase && cliCase.source, '--source or --family is required');
  assert(cliCase.builder, '--builder is required');
  try {
    results.push(runCase(repoRoot, cliCase));
  } catch (err) {
    results.push({
      id: cliCase.id,
      family: cliCase.family,
      status: 'FAIL',
      contractBroken: err.code === ERROR_CODES.BUILDER_DOCTOR_CONTRACT_BROKEN
    });
    printSummary(results);
    throw err;
  }
  printSummary(results);
}

try {
  main();
} catch (err) {
  if (err.code === ERROR_CODES.BUILDER_DOCTOR_CONTRACT_BROKEN) {
    process.exit(1);
  }
  console.error(err.stack || err.message || err);
  process.exit(1);
}
