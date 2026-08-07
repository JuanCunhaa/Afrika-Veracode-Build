# Changelog

Todas as mudancas notaveis deste projeto serao documentadas neste arquivo.

O formato e baseado no [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e este projeto adota [Versionamento Semantico](https://semver.org/lang/pt-BR/).

## [0.1.3] - 2026-08-07

### Added

- Suíte unitária expandida em `tests/unit/` (Discovery, BuildPlan, Doctor, Fingerprint, Config, Sanitize, Utils) com fixtures em `tests/fixtures/unit/`.
- Suíte de negative/failure tests em `tests/negative/` com assertion de error codes e status Doctor (INVALID vs READY_WITH_WARNINGS).
- Fixtures de integration reais em `tests/fixtures/integration/` (Java Maven/Gradle, JS/TS, .NET) + runner `scripts/run-integration-fixture.js`.
- **Builder → Doctor Contract Tests** em `tests/contract/builder-doctor/` + runner `scripts/run-builder-doctor-contract.js` (falha com `BUILDER_DOCTOR_CONTRACT_BROKEN` se Builder ok e Doctor `INVALID`); docs em `docs/BUILDER-DOCTOR-CONTRACT.md`.
- **Test Matrix** central em `tests/test-matrix.json` com perfis `pr` / `full` / `release` (resolve em `scripts/resolve-test-matrix.js`); shards Quality/Unit/Negative/Security/Builder-Doctor no workflow `CI`; schedule semanal full; docs em `docs/TEST-MATRIX.md`.
- Jobs de contract no workflow `CI` alimentando o Gate; matriz em `docs/INTEGRATION-MATRIX.md` / `docs/TEST-MATRIX.md`.
- Scripts `npm test` / `npm run test:unit` / `npm run test:negative` / `npm run test:coverage` / `npm run test:contract` / `npm run test:matrix`.

### Changed

- Detector Gradle reconhece `JavaLanguageVersion.of(N)` tambem em forma Kotlin DSL (`languageVersion.set`).
- Sanitize nunca persiste valores string sob chaves secret-like (ex.: `NUGET_TOKEN`), mesmo quando o valor parece um nome `UPPER_SNAKE`.

## [0.1.2] - 2026-08-07

### Changed

- Gate do workflow CI e a unica fonte de verdade; jobs novos devem entrar no Gate.

## [0.1.1] - 2026-08-07

### Changed

- Unificou Quality, Integration e Release em um unico workflow `CI` com jobs paralelos e gate final.

## [0.1.0] - 2026-08-07

### Added

- Action composite `Afrika-Veracode-Build` com orquestrador raiz.
- Discovery automatico para Java (Maven/Gradle), JavaScript/TypeScript e .NET.
- Builders para Maven, Gradle, source package JS/TS e .NET (moderno, Framework, ASP.NET, Blazor WASM).
- Doctor (preflight) baseado em requisitos publicos documentados da Veracode.
- Build Config remoto atualizavel com fingerprint SHA-256 e GitHub App/PAT.
- Inputs, outputs, codigos de erro padronizados e documentacao completa do MVP.

[0.1.3]: https://github.com/JuanCunhaa/Afrika-Veracode-Build/releases/tag/v0.1.3
[0.1.2]: https://github.com/JuanCunhaa/Afrika-Veracode-Build/releases/tag/v0.1.2
[0.1.1]: https://github.com/JuanCunhaa/Afrika-Veracode-Build/releases/tag/v0.1.1
[0.1.0]: https://github.com/JuanCunhaa/Afrika-Veracode-Build/releases/tag/v0.1.0
