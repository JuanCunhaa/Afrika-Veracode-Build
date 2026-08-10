#!/usr/bin/env node
/**
 * Enforce Java Feature Completeness from schemas/java-coverage-contract.json
 * against Lab matrix + applications corpus.
 *
 * Codes:
 *   JAVA_COVERAGE_BASIC_MISSING
 *   JAVA_COVERAGE_BRANCH_MISSING
 *   JAVA_COVERAGE_BOUNDARY_MISSING
 *   JAVA_COVERAGE_CONTRACT_INVALID
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ACTION_ROOT = path.resolve(__dirname, '../..');
const LAB_ROOT = process.env.LAB_ROOT
  ? path.resolve(process.env.LAB_ROOT)
  : path.resolve(ACTION_ROOT, '../Afrika-Veracode-Build-Lab');

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function caseExists(matrixKey, caseId, testMatrix) {
  return (testMatrix[matrixKey] || []).some(
    (c) => c.case === caseId && (c.profiles || []).includes('full')
  );
}

function fixtureExists(rel) {
  return fs.existsSync(path.join(LAB_ROOT, rel));
}

function expandName(template, version) {
  return String(template).replaceAll('{version}', String(version));
}

function main() {
  const contractPath = path.join(ACTION_ROOT, 'schemas/java-coverage-contract.json');
  const supportPath = path.join(ACTION_ROOT, 'schemas/support-matrix.json');
  const matrixPath = path.join(LAB_ROOT, 'matrix/test-matrix.json');
  /** @type {string[]} */
  const errors = [];

  if (!fs.existsSync(contractPath)) {
    console.error('JAVA_COVERAGE_CONTRACT_INVALID: schemas/java-coverage-contract.json missing');
    process.exit(1);
  }
  if (!fs.existsSync(matrixPath)) {
    console.error(`JAVA_COVERAGE_CONTRACT_INVALID: Lab matrix missing at ${matrixPath}`);
    process.exit(1);
  }

  const contract = loadJson(contractPath);
  const support = loadJson(supportPath);
  const testMatrix = loadJson(matrixPath);
  const mavenKey = contract.matrixKeys?.maven || 'javaMaven';
  const gradleKey = contract.matrixKeys?.gradle || 'javaGradle';
  const naming = contract.caseNaming || {};

  const declaredVersions = (contract.declaredRuntimes || []).map((r) => String(r.version));
  const supportJavaVersions = new Set(
    (support.rows || [])
      .filter((r) => r.capability === 'java-maven' || r.capability === 'java-gradle')
      .map((r) => String(r.version))
  );

  for (const v of declaredVersions) {
    if (!supportJavaVersions.has(v)) {
      errors.push(`JAVA_COVERAGE_CONTRACT_INVALID: runtime ${v} not in support-matrix Java rows`);
    }
    const basicMaven = expandName(naming.basic || 'java{version}-basic', v);
    const basicGradle = expandName(naming.basic || 'java{version}-basic', v);
    if (!caseExists(mavenKey, basicMaven, testMatrix)) {
      errors.push(`JAVA_COVERAGE_BASIC_MISSING: Maven Basic full case missing for Java ${v} (${basicMaven})`);
    }
    if (!caseExists(gradleKey, basicGradle, testMatrix)) {
      errors.push(`JAVA_COVERAGE_BASIC_MISSING: Gradle Basic full case missing for Java ${v} (${basicGradle})`);
    }
    if (!fixtureExists(`applications/java/maven/${basicMaven}`)) {
      errors.push(`JAVA_COVERAGE_BASIC_MISSING: fixture applications/java/maven/${basicMaven}`);
    }
    if (!fixtureExists(`applications/java/gradle/${basicGradle}`)) {
      errors.push(`JAVA_COVERAGE_BASIC_MISSING: fixture applications/java/gradle/${basicGradle}`);
    }
    if (!fixtureExists(`applications/java/maven/${basicMaven}/.veracode-lab.json`)) {
      errors.push(`JAVA_COVERAGE_BASIC_MISSING: goat manifest maven/${basicMaven}`);
    }
    if (!fixtureExists(`applications/java/gradle/${basicGradle}/.veracode-lab.json`)) {
      errors.push(`JAVA_COVERAGE_BASIC_MISSING: goat manifest gradle/${basicGradle}`);
    }
  }

  /** @type {Record<string, { key: string, nameTpl: string }>} */
  const branchMap = {
    'maven-spring-boot': { key: mavenKey, nameTpl: naming.springBoot || 'springboot-java{version}' },
    'gradle-spring-boot': { key: gradleKey, nameTpl: naming.springBoot || 'springboot-java{version}' },
    'maven-war': { key: mavenKey, nameTpl: naming.war || 'war-java{version}' },
    'gradle-war': { key: gradleKey, nameTpl: naming.war || 'war-java{version}' },
    'maven-multi-module': { key: mavenKey, nameTpl: naming.multiModule || 'multimodule-java{version}' },
    'gradle-multi-module': { key: gradleKey, nameTpl: naming.multiModule || 'multimodule-java{version}' },
    'gradle-kotlin-dsl': { key: gradleKey, nameTpl: naming.kotlinDsl || 'kotlin-dsl-java{version}' }
  };

  for (const branch of contract.requiredBranches || []) {
    if (branch.requiredOnRuntimes === 'all') continue; // handled by basic checks
    const map = branchMap[branch.id];
    if (!map) continue;
    const boundaries = branch.boundaryRuntimes || [];
    let found = 0;
    for (const row of testMatrix[map.key] || []) {
      if (!(row.profiles || []).includes('full')) continue;
      const tplPrefix = String(map.nameTpl).split('{version}')[0];
      if (String(row.case).startsWith(tplPrefix.replace(/-$/, '')) || row.case.includes(tplPrefix)) {
        // better: exact template match for known versions
      }
      for (const v of declaredVersions) {
        if (row.case === expandName(map.nameTpl, v)) found += 1;
      }
    }
    // recount uniquely
    found = 0;
    const present = [];
    for (const v of declaredVersions) {
      const id = expandName(map.nameTpl, v);
      if (caseExists(map.key, id, testMatrix)) {
        found += 1;
        present.push(v);
      }
    }
    if (found < (branch.minFixtures || 1)) {
      errors.push(
        `JAVA_COVERAGE_BRANCH_MISSING: ${branch.id} needs ≥${branch.minFixtures || 1} Lab full fixture(s), found ${found}`
      );
    }
    for (const v of boundaries) {
      const id = expandName(map.nameTpl, v);
      if (!caseExists(map.key, id, testMatrix)) {
        errors.push(`JAVA_COVERAGE_BOUNDARY_MISSING: ${branch.id} missing boundary runtime ${v} (${id})`);
      }
    }
  }

  const report = [
    '# Java Coverage Contract',
    '',
    `| Metric | Count |`,
    `| --- | ---: |`,
    `| Declared Java runtimes | ${declaredVersions.length} |`,
    `| Required special branches | ${(contract.requiredBranches || []).filter((b) => b.requiredOnRuntimes !== 'all').length} |`,
    '',
    errors.length ? 'Result: FAIL' : 'Result: PASS',
    ...errors.map((e) => `- ${e}`)
  ].join('\n');

  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);
  if (errors.length) process.exit(1);
}

main();
