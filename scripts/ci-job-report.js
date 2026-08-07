'use strict';

/**
 * Append a contract/quality result row + duration to GITHUB_STEP_SUMMARY.
 *
 *   node scripts/ci-job-report.js \
 *     --tech "Java Maven" --version 17 --scenario Basic \
 *     --result PASS --seconds 12.4
 */

const fs = require('fs');

function arg(name, fallback = '') {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

const tech = arg('tech', 'unknown');
const version = arg('version', '-');
const scenario = arg('scenario', '-');
const result = arg('result', 'PASS');
const seconds = arg('seconds', '');
const job = arg('job', '');

const summary = process.env.GITHUB_STEP_SUMMARY;
if (!summary) {
  console.log(`${tech}\t${version}\t${scenario}\t${result}\t${seconds}s`);
  process.exit(0);
}

let existing = '';
try {
  existing = fs.readFileSync(summary, 'utf8');
} catch {
  /* empty */
}

if (!existing.includes('| Technology | Version | Scenario | Result |')) {
  fs.appendFileSync(
    summary,
    `\n## Results\n\n| Technology | Version | Scenario | Result | Duration |\n| --- | --- | --- | --- | --- |\n`
  );
}

const dur = seconds ? `${seconds}s` : '-';
fs.appendFileSync(summary, `| ${tech} | ${version} | ${scenario} | ${result} | ${dur} |\n`);

if (job && seconds) {
  fs.appendFileSync(summary, `\n<!-- timing:${job}=${seconds} -->\n`);
}

console.log(`reported ${tech} ${version} ${scenario} ${result} ${dur}`);
