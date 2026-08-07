'use strict';

const { appendStepSummary } = require('../common/io');

/**
 * Resumo ASCII e GITHUB_STEP_SUMMARY.
 */

function pad(label, value, width = 14) {
  const l = String(label).padEnd(width, ' ');
  return `║ ${l} ${String(value).padEnd(20, ' ')} ║`;
}

/**
 * @param {object} summary
 */
function printAsciiSummary(summary) {
  const lines = [
    '╔══════════════════════════════════════╗',
    '║       AFRIKA VERACODE BUILD          ║',
    '╠══════════════════════════════════════╣',
    pad('Language', summary.language || '-'),
    pad('Framework', summary.framework || '-'),
    pad('Runtime', summary.runtime || '-'),
    pad('Build System', summary.buildSystem || '-'),
    pad('Strategy', summary.strategy || '-'),
    pad('Artifact', summary.artifactName || '-'),
    pad('Doctor', summary.doctorStatus || '-'),
    pad('Config', summary.configStatus || '-'),
    '╚══════════════════════════════════════╝'
  ];
  console.log(lines.join('\n'));
}

/**
 * @param {object} summary
 */
function writeStepSummary(summary) {
  const warnings = (summary.warnings || []).map((w) => `- ${w}`).join('\n') || '_Nenhum_';
  const md = [
    '## Afrika Veracode Build',
    '',
    `| Campo | Valor |`,
    `| --- | --- |`,
    `| Language | ${summary.language || '-'} |`,
    `| Framework | ${summary.framework || '-'} |`,
    `| Runtime | ${summary.runtime || '-'} |`,
    `| Build System | ${summary.buildSystem || '-'} |`,
    `| Strategy | ${summary.strategy || '-'} |`,
    `| Artifact | \`${summary.artifactPath || summary.artifactName || '-'}\` |`,
    `| Doctor | ${summary.doctorStatus || '-'} |`,
    `| Config | ${summary.configStatus || '-'} |`,
    `| Confidence | ${summary.confidence || '-'} |`,
    '',
    '### Timings',
    '',
    summary.timings
      ? Object.entries(summary.timings)
          .map(([k, v]) => `- ${k}: ${typeof v === 'number' ? `${v.toFixed(1)}s` : v}`)
          .join('\n')
      : '_N/A_',
    '',
    '### Warnings',
    '',
    warnings,
    '',
    '> Validacao: Veracode-ready according to documented packaging requirements (nao substitui o prescan da Veracode).',
    ''
  ].join('\n');
  appendStepSummary(md);
}

module.exports = {
  printAsciiSummary,
  writeStepSummary
};
