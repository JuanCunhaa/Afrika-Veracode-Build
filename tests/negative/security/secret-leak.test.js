'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { discover } = require('../../../internal/discovery/discovery');
const { toBuildPlan } = require('../../../internal/discovery/build-plan');
const { doctorJavaScript } = require('../../../internal/doctor/javascript/doctor');
const { validateBuildConfig } = require('../../../internal/utils/schemas/validate');
const { scrubSecretsFromObject, sanitizeLog } = require('../../../internal/utils/sanitize/sanitize');
const { writeJson } = require('../../../internal/utils/common/io');
const { zipFromFiles, tmpDir } = require('../helpers/assert');

const SECRET = 'SUPER_SECRET_TEST_839201';

describe('negative / security', () => {
  it('secret sintetico nao aparece em artifacts persistidos de discovery/doctor/config', () => {
    const out = tmpDir('sec-out-');
    const veracodeBuild = path.join(out, '.veracode-build');
    fs.mkdirSync(veracodeBuild, { recursive: true });

    const src = tmpDir('sec-src-');
    fs.writeFileSync(
      path.join(src, 'package.json'),
      JSON.stringify({
        name: 'sec-fixture',
        version: '1.0.0',
        dependencies: { express: '4.0.0' }
      })
    );
    fs.writeFileSync(path.join(src, 'package-lock.json'), '{"lockfileVersion":3}');
    fs.writeFileSync(path.join(src, 'index.js'), 'module.exports=1');

    const discovery = discover(src);
    const poisonedDiscovery = scrubSecretsFromObject({
      ...discovery,
      NUGET_TOKEN: SECRET,
      dependencies: {
        requiredEnvironmentVariables: ['NUGET_TOKEN'],
        NUGET_TOKEN: SECRET
      }
    });
    writeJson(path.join(veracodeBuild, 'discovery-result.json'), poisonedDiscovery);

    const plan = toBuildPlan(discovery);
    writeJson(path.join(veracodeBuild, 'build-plan.json'), plan);

    const { zip } = zipFromFiles({
      'index.js': 'module.exports=1',
      'package.json': '{"name":"x"}',
      'package-lock.json': '{}'
    });
    const doctor = doctorJavaScript(zip, { language: 'javascript' });
    writeJson(path.join(veracodeBuild, 'doctor-result.json'), doctor);

    const config = validateBuildConfig(
      scrubSecretsFromObject({
        schemaVersion: 1,
        repository: 'org/app',
        discovery: { language: 'javascript', confidence: 'HIGH' },
        builder: { strategy: 'SOURCE_PACKAGE' },
        fingerprint: { algorithm: 'sha256', value: 'abc' },
        NUGET_TOKEN: SECRET,
        dependencies: { requiredEnvironmentVariables: ['NUGET_TOKEN'] }
      })
    );
    writeJson(path.join(veracodeBuild, 'build-config.json'), config);

    const logs = [
      sanitizeLog(`token=ghp_abcdefghijklmnopqrstuvwxyz0123456789`),
      sanitizeLog(`Authorization: Bearer abcdefghijklmnop.qrstuv.xyz`)
    ].join('\n');

    const targets = [
      path.join(veracodeBuild, 'discovery-result.json'),
      path.join(veracodeBuild, 'doctor-result.json'),
      path.join(veracodeBuild, 'build-config.json'),
      path.join(veracodeBuild, 'build-plan.json')
    ];

    for (const file of targets) {
      const text = fs.readFileSync(file, 'utf8');
      assert.equal(text.includes(SECRET), false, `secret vazou em ${path.basename(file)}`);
    }
    assert.doesNotMatch(logs, /ghp_/);
    assert.doesNotMatch(logs, /Bearer\s+[A-Za-z0-9]/i);
    // Valor sintetico em chave secret-like nao deve persistir apos scrub
    assert.equal(JSON.stringify(poisonedDiscovery).includes(SECRET), false);
  });
});
