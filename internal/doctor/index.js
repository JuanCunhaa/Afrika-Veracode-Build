'use strict';

const path = require('path');
const { doctorJava } = require('./java/doctor');
const { doctorJavaScript } = require('./javascript/doctor');
const { doctorDotnet } = require('./dotnet/doctor');
const {
  setOutputs,
  readJson,
  writeJson,
  envStr,
  envBool,
  ensureDir,
  timingNow,
  timingMs
} = require('../utils/common/io');
const { validateDoctorResult } = require('../utils/schemas/validate');
const { fail, ERROR_CODES } = require('../utils/errors/errors');

const REGISTRY = {
  'java-compiled': doctorJava,
  'java-source': doctorJava,
  'javascript-source': doctorJavaScript,
  'typescript-source': doctorJavaScript,
  'dotnet-modern': doctorDotnet,
  'dotnet-framework': doctorDotnet,
  'dotnet-blazor-wasm': doctorDotnet
};

function main() {
  const start = timingNow();
  const artifactPath = path.resolve(envStr('ARTIFACT_PATH', ''));
  const planPath = envStr('BUILD_PLAN_PATH', '');
  const outputDir = path.resolve(envStr('OUTPUT_DIR', '.veracode-build'));
  const doctorMode = envStr('DOCTOR_MODE', 'standard');
  const failOnWarning = envBool('FAIL_ON_DOCTOR_WARNING', false);

  let plan = {};
  if (planPath) {
    try {
      plan = readJson(planPath);
    } catch {
      plan = {};
    }
  }

  const profile = envStr('DOCTOR_PROFILE', '') || plan.doctorProfile || 'java-compiled';
  const fn =
    REGISTRY[profile] ||
    (plan.language === 'dotnet'
      ? doctorDotnet
      : plan.language === 'javascript' || plan.language === 'typescript'
        ? doctorJavaScript
        : doctorJava);

  const result = fn(artifactPath, { ...plan, doctorProfile: profile });
  const validated = validateDoctorResult(result);

  ensureDir(outputDir);
  const outFile = path.join(outputDir, 'doctor-result.json');
  writeJson(outFile, validated);

  let failed = validated.status === 'INVALID';
  if (doctorMode === 'strict' && validated.status === 'READY_WITH_WARNINGS') {
    failed = true;
  }
  if (failOnWarning && (validated.warnings || []).length > 0) {
    failed = true;
  }

  const elapsed = timingMs(start) / 1000;
  setOutputs({
    doctor_status: validated.status,
    doctor_warnings: (validated.warnings || []).join(' | '),
    doctor_result_path: outFile,
    doctor_seconds: elapsed.toFixed(3)
  });

  console.log(`Doctor: ${validated.status} (${elapsed.toFixed(1)}s)`);
  for (const c of validated.checks) {
    console.log(` - [${c.status}] ${c.id}${c.message ? `: ${c.message}` : ''}`);
  }

  if (failed) {
    fail(ERROR_CODES.DOCTOR_FAILED, `Doctor status=${validated.status}`, {
      stage: 'Doctor',
      howToFix: 'Consulte .veracode-build/doctor-result.json e docs/VERACODE-PACKAGING.md'
    });
  }
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(`::error::${err.message || err}`);
    process.exit(1);
  }
}

module.exports = { main, REGISTRY };
