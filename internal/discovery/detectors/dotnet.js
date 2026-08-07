'use strict';

const fs = require('fs');
const path = require('path');

function walk(dir, acc = [], depth = 0) {
  if (depth > 6) return acc;
  if (!fs.existsSync(dir)) return acc;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const ent of entries) {
    if (ent.name === 'node_modules' || ent.name === '.git' || ent.name === 'bin' || ent.name === 'obj') continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, acc, depth + 1);
    else acc.push(full);
  }
  return acc;
}

function toPosix(p, root) {
  return path.relative(root, p).split(path.sep).join('/');
}

function readText(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return '';
  }
}

function isTestProject(content) {
  return (
    /IsTestProject\s*>\s*true/i.test(content) ||
    /Microsoft\.NET\.Test\.Sdk/i.test(content) ||
    /xunit/i.test(content) ||
    /NUnit/i.test(content) ||
    /MSTest/i.test(content)
  );
}

function classifyProject(content, fileName) {
  if (
    /Microsoft\.NET\.Sdk\.WebAssembly|BlazorWebAssembly|Microsoft\.AspNetCore\.Components\.WebAssembly/i.test(content)
  ) {
    return 'blazor-wasm';
  }
  if (/AzureFunctionsVersion|Microsoft\.NET\.Sdk\.Functions/i.test(content)) return 'azure-functions';
  if (/UseWPF\s*>\s*true|Microsoft\.NET\.Sdk\.WindowsDesktop/i.test(content) && /UseWPF\s*>\s*true/i.test(content)) {
    return 'wpf';
  }
  if (/UseWindowsForms\s*>\s*true/i.test(content)) return 'winforms';
  if (/Microsoft\.NET\.Sdk\.Web/i.test(content) || /Microsoft\.AspNetCore/i.test(content)) return 'aspnet-core';
  if (/ProjectTypeGuids.*349c5851|System\.Web|packages\.config/i.test(content) && /\.csproj$/i.test(fileName)) {
    // classic hints
    if (/TargetFrameworkVersion/i.test(content) && !/TargetFramework>/i.test(content)) return 'aspnet';
  }
  if (/OutputType\s*>\s*Exe/i.test(content) || /OutputType\s*>\s*WinExe/i.test(content)) return 'console';
  if (/OutputType\s*>\s*Library/i.test(content) || /Sdk="Microsoft\.NET\.Sdk"/i.test(content)) return 'class-library';
  return 'class-library';
}

function extractTargetFrameworks(content) {
  const multi = content.match(/<TargetFrameworks>\s*([^<]+)/i);
  if (multi) {
    return multi[1]
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const single = content.match(/<TargetFramework>\s*([^<]+)/i);
  if (single) return [single[1].trim()];
  const legacy = content.match(/<TargetFrameworkVersion>\s*v?([^<]+)/i);
  if (legacy) return [`net${legacy[1].replace(/\./g, '')}`.replace('net48', 'net48')];
  return [];
}

function isModernTfms(tfms) {
  return tfms.some((t) => /^(netcoreapp|netstandard|net[5-9]|net1[0-9])/i.test(t));
}

function isFrameworkTfms(tfms) {
  return tfms.some((t) => /^net[0-4]/i.test(t) || /^v4\./i.test(t));
}

function detectNotImplemented(content) {
  if (/CppCli|CLRSupport|LanguageStandard.*CLI|<CLRSupport>/i.test(content) || /\.vcxproj$/i.test(content)) {
    return 'C++/CLI';
  }
  if (/Xamarin/i.test(content)) return 'Xamarin';
  if (/Microsoft\.NET\.Sdk\.Maui|UseMaui\s*>\s*true/i.test(content)) return '.NET MAUI';
  return null;
}

function detectRequiredEnv(root, files) {
  const names = new Set();
  for (const f of ['NuGet.Config', 'nuget.config']) {
    const p = path.join(root, f);
    if (!fs.existsSync(p)) continue;
    const text = readText(p);
    const refs = text.matchAll(/%([A-Z][A-Z0-9_]*)%|\$([A-Z][A-Z0-9_]*)/g);
    for (const m of refs) {
      const n = m[1] || m[2];
      if (/(TOKEN|PASSWORD|USERNAME|KEY|SECRET|AUTH)/i.test(n)) names.add(n);
    }
    if (/NUGET_TOKEN/.test(text)) names.add('NUGET_TOKEN');
  }
  for (const file of files) {
    if (!/\.(csproj|vbproj|props|targets)$/i.test(file)) continue;
    const text = readText(file);
    const refs = text.matchAll(/\$\(([A-Z][A-Z0-9_]*)\)/g);
    for (const m of refs) {
      if (/(TOKEN|PASSWORD|USERNAME|KEY|SECRET|AUTH)/i.test(m[1])) names.add(m[1]);
    }
  }
  return [...names];
}

/**
 * @param {string} root
 * @param {{ projectPath?: string }} [opts]
 * @returns {object|null}
 */
function detect(root, opts = {}) {
  const all = walk(root);
  const slns = all.filter((f) => /\.slnx?$/i.test(f));
  const projs = all.filter((f) => /\.(csproj|vbproj)$/i.test(f));

  if (slns.length === 0 && projs.length === 0) {
    if (!fs.existsSync(path.join(root, 'global.json')) && !fs.existsSync(path.join(root, 'packages.config'))) {
      return null;
    }
  }

  const explicit = (opts.projectPath || '').trim();
  let selectedSln = null;
  let selectedProj = null;

  if (explicit && explicit !== '.' && explicit !== './') {
    const abs = path.resolve(root, explicit);
    if (fs.existsSync(abs) && /\.slnx?$/i.test(abs)) selectedSln = abs;
    else if (fs.existsSync(abs) && /\.(csproj|vbproj)$/i.test(abs)) selectedProj = abs;
    else if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
      const nested = walk(abs);
      const nestedSlns = nested.filter((f) => /\.slnx?$/i.test(f));
      const nestedProjs = nested.filter((f) => /\.(csproj|vbproj)$/i.test(f));
      if (nestedSlns.length === 1) selectedSln = nestedSlns[0];
      else if (nestedSlns.length > 1) {
        return {
          schemaVersion: 1,
          language: 'dotnet',
          ambiguous: true,
          confidence: 'LOW',
          candidates: nestedSlns.map((f) => toPosix(f, root)),
          projectPath: explicit,
          packagingStrategy: 'BUILD_REQUIRED',
          requiredEnvironmentVariables: [],
          warnings: []
        };
      } else if (nestedProjs.length === 1) selectedProj = nestedProjs[0];
    }
  } else if (slns.length > 1) {
    return {
      schemaVersion: 1,
      language: 'dotnet',
      ambiguous: true,
      confidence: 'LOW',
      candidates: slns.map((f) => toPosix(f, root)),
      projectPath: '.',
      packagingStrategy: 'BUILD_REQUIRED',
      requiredEnvironmentVariables: [],
      warnings: [],
      message: 'Multiplos arquivos .sln encontrados e nenhum project_path informado.'
    };
  } else if (slns.length === 1) {
    selectedSln = slns[0];
  } else if (projs.length === 1) {
    selectedProj = projs[0];
  } else if (projs.length > 1) {
    // prefer non-test
    const nonTest = projs.filter((p) => !isTestProject(readText(p)));
    if (nonTest.length === 1) selectedProj = nonTest[0];
    else {
      return {
        schemaVersion: 1,
        language: 'dotnet',
        ambiguous: true,
        confidence: 'LOW',
        candidates: projs.map((f) => toPosix(f, root)),
        projectPath: '.',
        packagingStrategy: 'BUILD_REQUIRED',
        requiredEnvironmentVariables: [],
        warnings: [],
        message: 'Multiplos projetos .csproj/.vbproj encontrados e nenhum project_path informado.'
      };
    }
  }

  const entry = selectedSln || selectedProj;
  const entryContent = entry ? readText(entry) : '';

  let tfms = [];
  let projectType = 'class-library';
  let notImpl = null;
  const testProjects = [];

  for (const pf of projs) {
    const content = readText(pf);
    if (isTestProject(content)) {
      testProjects.push(toPosix(pf, root));
      continue;
    }
    const t = extractTargetFrameworks(content);
    tfms.push(...t);
    const cls = classifyProject(content, pf);
    if (cls === 'blazor-wasm' || cls === 'aspnet-core' || cls === 'aspnet' || cls === 'azure-functions') {
      projectType = cls;
    } else if (projectType === 'class-library') {
      projectType = cls;
    }
    const ni = detectNotImplemented(content);
    if (ni) notImpl = ni;
  }

  if (tfms.length === 0 && entryContent) {
    tfms = extractTargetFrameworks(entryContent);
  }

  const modern = isModernTfms(tfms);
  const framework = isFrameworkTfms(tfms) && !modern;
  const runtimeVersion =
    tfms[0] ||
    (fs.existsSync(path.join(root, 'global.json'))
      ? (JSON.parse(readText(path.join(root, 'global.json')) || '{}').sdk || {}).version || 'auto'
      : 'auto');

  let family = modern ? 'dotnet-modern' : framework ? 'dotnet-framework' : 'dotnet-modern';
  if (projectType === 'aspnet') family = 'aspnet';
  if (projectType === 'aspnet-core') family = 'aspnet-core';
  if (projectType === 'blazor-wasm') family = 'blazor-wasm';

  const requiredEnvironmentVariables = detectRequiredEnv(root, all);
  const runnerOs = family === 'dotnet-framework' || family === 'aspnet' ? ['windows'] : ['linux', 'windows', 'macos'];

  const doctorProfile =
    family === 'blazor-wasm'
      ? 'dotnet-blazor-wasm'
      : family === 'aspnet' || family === 'dotnet-framework'
        ? 'dotnet-framework'
        : 'dotnet-modern';

  return {
    schemaVersion: 1,
    language: 'dotnet',
    ecosystem: 'dotnet',
    framework: family,
    runtimeVersion: String(runtimeVersion),
    buildSystem: modern || family === 'aspnet-core' || family === 'blazor-wasm' ? 'dotnet' : 'msbuild',
    packageManager: 'nuget',
    projectType,
    projectPath: entry ? toPosix(entry, root) : '.',
    packagingStrategy: 'BUILD_REQUIRED',
    artifactCandidates: ['**/bin/Debug/**/*.dll', '**/publish/**/*.dll'],
    wrapper: null,
    requiredEnvironmentVariables,
    confidence: entry ? 'HIGH' : 'MEDIUM',
    warnings: notImpl ? [`${notImpl} detectado: NOT_IMPLEMENTED no MVP (Fase 2).`] : [],
    doctorProfile,
    restoreRequired: true,
    privateRegistryDetected: requiredEnvironmentVariables.length > 0,
    testProjects,
    targetFrameworks: [...new Set(tfms)],
    runnerRequirements: { os: runnerOs },
    notImplemented: Boolean(notImpl),
    notImplementedTechnology: notImpl,
    ambiguous: false
  };
}

module.exports = { detect, isTestProject, classifyProject, extractTargetFrameworks };
