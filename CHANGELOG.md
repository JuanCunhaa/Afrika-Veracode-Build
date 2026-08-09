# Changelog

Todas as mudancas notaveis deste projeto serao documentadas neste arquivo.

O formato e baseado no [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e este projeto adota [Versionamento Semantico](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Added

- **Product Quality Gate** / **Product Main Gate** (`.github/workflows/product-gate.yml` + Lab Orchestrator publishing).
- **Release Certification Gate** (`.github/workflows/release-certification.yml`) — SHA-bound Local+Lab full+Veracode full; no automatic tag publish.
- Declared support rows with stable IDs (`schemas/support-matrix.json` schemaVersion 2) including `veracodeCertification.cases` (packaging variants).
- Machine-generated `schemas/certification-status.json` + event policy `schemas/event-policy.json`.
- Automated README support matrix (`npm run docs:support:generate` / `docs:support:check`).
- Veracode ✅ requires **all** required Pipeline Scan cases for that public row (e.g. Java Maven 17 JAR+WAR).
- Release Veracode `full` = **all 40 Lab Compatibility Full** cases, embedded in Lab Gate (`veracode_profile=full`, reuses Builder packs).
- Lab Gate `veracode_profile` input: `none` | `representative` | `full` — Pipeline Scan in the same run after Builder→Doctor.

### Fixed

- Gradle discovery: `JavaVersion.VERSION_1_8` resolves to runtime `8` (not `1`).
- Maven discovery: aggregator `packaging=pom` collects module artifacts via `*/target/*.jar`.
- Artifact glob resolver expands one-level directory `*` (so `*/target/*.jar` finds module jars).

### Changed

- Externalized compatibility and real-application test laboratory to **Afrika-Veracode-Build-Lab**.
- Integrated remote Lab validation via trusted Lab Orchestrator into **Lab Compatibility Gate** (required check alongside Local Gate).
- Event-aware Lab suite orchestration: feature push / PR / merge_group → `pr`; push `main` → `full` + Veracode **representative** → Product Main Gate.
- CI runs on all branch pushes, `merge_group`, and PR `ready_for_review` (not only `main` + PR).
- CI final job renamed to **Local Gate**; contract/integration matrix jobs removed from Action CI; Local Gate now includes support-matrix docs sync.
- Automatic GitHub Release on push `main` **disabled** until Release Certification Gate PASS for the same SHA.
- README rewritten in pt-BR (product documentation); support table is machine-generated.
- `schemas/capabilities.json` uses `actionValidation` + `labValidation` (logical Lab keys).
- Action Completeness no longer requires local integration/contract/golden/matrix paths.
- Lab Orchestrator concurrency groups by **source branch** (cancels superseded Lab waits on the same PR); no longer falls back to `github.sha` (default-branch tip).
- When Local Gate fails, Lab Compatibility Gate is published as **failure** (“Lab not dispatched”) instead of leaving the required check pending.

### Removed

- Lab Orchestrator manual suite option `release` (use `full` + separate Veracode E2E for release).
- `tests/fixtures/integration/`, `tests/artifacts/`, `tests/contract/` cases, `tests/test-matrix.json`, `tests/e2e/veracode/` (copied to Lab; Lost tests = 0).
- Action scripts `run-builder-doctor-contract.js`, `run-integration-fixture.js`, `generate-integration-fixtures.js`, `resolve-test-matrix.js` (Lab owns them).

## [0.1.3] - 2026-08-07

### Added

- Suíte unitária expandida em `tests/unit/` (Discovery, BuildPlan, Doctor, Fingerprint, Config, Sanitize, Utils) com fixtures em `tests/fixtures/unit/`.
- Suíte de negative/failure tests em `tests/negative/` com assertion de error codes e status Doctor (INVALID vs READY_WITH_WARNINGS).
- Fixtures de integration reais em `tests/fixtures/integration/` (Java Maven/Gradle, JS/TS, .NET) + runner `scripts/run-integration-fixture.js`.
- **Builder → Doctor Contract Tests** em `tests/contract/builder-doctor/` + runner `scripts/run-builder-doctor-contract.js` (falha com `BUILDER_DOCTOR_CONTRACT_BROKEN` se Builder ok e Doctor `INVALID`); docs em `docs/BUILDER-DOCTOR-CONTRACT.md`.
- **Test Matrix** central em `tests/test-matrix.json` com perfis `pr` / `full` / `release` (resolve em `scripts/resolve-test-matrix.js`); shards Quality/Unit/Negative/Security/Builder-Doctor no workflow `CI`; schedule semanal full; docs em `docs/TEST-MATRIX.md`.
- Politica **Secret Zero-Leak**: sanitizacao central (`sanitizeText` / `sanitizeError` / `sanitizeCommand` / `registerSecret`), `writeJson` scrub, job Gate `secret-leak` (`tests/security/secret-leak/`), docs em `SECURITY.md`.
- Politica **Feature Completeness** (NO PARTIAL FEATURE): `docs/FEATURE-COMPLETENESS.md`, SoT `schemas/capabilities.json`, validator `npm run check:completeness` (`FEATURE_COMPLETENESS_FAILED`), job Gate `feature-completeness`, PR/issue templates.
- Jobs de contract no workflow `CI` alimentando o Gate; matriz em `docs/INTEGRATION-MATRIX.md` / `docs/TEST-MATRIX.md`.
- Scripts `npm test` / `npm run test:unit` / `npm run test:negative` / `npm run test:coverage` / `npm run test:contract` / `npm run test:matrix` / `npm run test:secret-leak` / `npm run check:completeness`.

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
