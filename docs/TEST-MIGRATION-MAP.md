# Test Migration Map

Inventory for dual-repository migration: **Afrika-Veracode-Build** (product) ↔ **Afrika-Veracode-Build-Lab** (private quality lab).

Rule: `COPY → ADAPT → TEST → VERIFY PARITY → DELETE ORIGINAL`. No test may disappear (`Lost tests = 0`).

Classification: `KEEP_ACTION` | `MOVE_LAB` | `REFACTOR` | `REMOVE_DUPLICATE`.

---

## Summary

| Class            |                                             Count (approx) | Notes                                    |
| ---------------- | ---------------------------------------------------------: | ---------------------------------------- |
| KEEP_ACTION      |                 unit + negative + security + unit fixtures | Logic / local completeness               |
| MOVE_LAB         | integration apps, golden artifacts, contracts, matrix, e2e | Compatibility corpus                     |
| REFACTOR         |           completeness checker, capabilities.json, CI Gate | Dual completeness + trusted orchestrator |
| REMOVE_DUPLICATE |                                        none identified yet | Only after Lab parity                    |

---

## KEEP_ACTION

| Old path                                       | Purpose                                                                                  | Technology       | Execution                    |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------- | ---------------------------- |
| `tests/unit/**`                                | Discovery, BuildPlan, Doctor rules, fingerprint, config, sanitize, utils, matrix helpers | Node `node:test` | `ci.yml` → Unit → Local Gate |
| `tests/fixtures/unit/**`                       | Small parse fixtures (pom, package.json, csproj, gradle)                                 | fixtures         | unit tests                   |
| `tests/negative/**`                            | Logic failures + ephemeral synthetic archives                                            | Node             | `ci.yml` → Negative          |
| `tests/security/check-action-pinning.js`       | SHA pinning                                                                              | Node             | Security job                 |
| `tests/security/check-feature-completeness.js` | Action Completeness (post-refactor)                                                      | Node             | Feature Completeness         |
| `tests/security/secret-leak/**`                | Zero-leak                                                                                | Node             | secret-leak job              |
| `scripts/run-unit-tests.js`                    | Unit runner                                                                              | Node             | local CI                     |
| `scripts/generate-unit-fixtures.js`            | Unit fixture generator                                                                   | Node             | local                        |
| `scripts/bump-version.js`                      | Version bump                                                                             | Node             | release                      |
| `scripts/ci-job-report.js`                     | Job summary helper                                                                       | Node             | local CI (copy also in Lab)  |

---

## MOVE_LAB

| Old path                                    | New path                                   | Purpose                            | Technology      | Execution workflow              |
| ------------------------------------------- | ------------------------------------------ | ---------------------------------- | --------------- | ------------------------------- |
| `tests/fixtures/integration/java/maven/*`   | `applications/java/maven/*`                | Real Maven apps                    | Java/Maven      | `lab-gate.yml` integration      |
| `tests/fixtures/integration/java/gradle/*`  | `applications/java/gradle/*`               | Real Gradle apps                   | Java/Gradle     | lab-gate                        |
| `tests/fixtures/integration/javascript/*`   | `applications/javascript/*`                | Real JS apps                       | Node            | lab-gate                        |
| `tests/fixtures/integration/typescript/*`   | `applications/typescript/*`                | Real TS apps                       | Node/TS         | lab-gate                        |
| `tests/fixtures/integration/dotnet/*`       | `applications/dotnet/*`                    | Real .NET apps                     | .NET            | lab-gate                        |
| `tests/fixtures/integration/private-deps/*` | `applications/private-deps/*`              | Private registry config samples    | config          | lab (isolated; no real secrets) |
| `tests/artifacts/**`                        | `golden-artifacts/**`                      | Golden / expected packs            | zip/json        | golden-artifacts.yml / lab-gate |
| `tests/contract/builder-doctor/**`          | `contracts/builder-doctor/**`              | Builder→Doctor contract            | Node + fixtures | lab-gate contract jobs          |
| `tests/test-matrix.json`                    | `matrix/test-matrix.json`                  | PR/full/release matrix SoT for Lab | JSON            | lab-gate / full-matrix          |
| `tests/e2e/veracode/**`                     | `e2e/veracode/**`                          | Veracode E2E evidence placeholder  | markdown        | veracode-e2e.yml (trusted-only) |
| `scripts/run-builder-doctor-contract.js`    | `scripts/run-builder-doctor-contract.js`   | Contract runner                    | Node            | Lab CI                          |
| `scripts/run-integration-fixture.js`        | `scripts/run-integration-fixture.js`       | Integration runner                 | Node            | Lab CI                          |
| `scripts/generate-integration-fixtures.js`  | `scripts/generate-integration-fixtures.js` | Fixture generator                  | Node            | Lab maint                       |
| `scripts/resolve-test-matrix.js`            | `scripts/resolve-test-matrix.js`           | Matrix resolve                     | Node            | Lab CI                          |

---

## REFACTOR (Action)

| Path                                                                           | Change                                                                                        |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `schemas/capabilities.json`                                                    | Split `actionValidation` vs `labValidation`; remove Action-local path coupling for Lab corpus |
| `tests/security/check-feature-completeness.js`                                 | Action Completeness only (no local integration/contract/golden/matrix file requirements)      |
| `.github/workflows/ci.yml`                                                     | Becomes **Local Gate**; no Lab secrets; drops migrated matrix jobs after parity               |
| `.github/workflows/lab-orchestrator.yml`                                       | **NEW** trusted workflow on default branch; GitHub App; Lab Compatibility Gate                |
| `scripts/lab/dispatch-and-wait.mjs`                                            | **NEW** App auth, `return_run_details`, poll by `workflow_run_id`                             |
| `docs/FEATURE-COMPLETENESS.md`, `ARCHITECTURE.md`, `README.md`, `CHANGELOG.md` | Dual-repo docs                                                                                |
| `docs/TEST-LAB.md`, `docs/BRANCH-PROTECTION.md`                                | **NEW**                                                                                       |

---

## REFACTOR (Lab — new)

| Path                                                                           | Purpose                                            |
| ------------------------------------------------------------------------------ | -------------------------------------------------- |
| `scripts/validate-lab-completeness.mjs`                                        | Lab Completeness vs Action SHA `capabilities.json` |
| `scripts/validate-result.mjs` / `collect-results.mjs` / `generate-summary.mjs` | lab-result.json + summaries                        |
| `scripts/security/check-action-pinning.js`                                     | Lab workflow SHA pinning                           |
| `.github/workflows/lab-gate.yml`                                               | Primary compatibility gate                         |
| `.github/workflows/full-matrix.yml`                                            | Full suite                                         |
| `.github/workflows/golden-artifacts.yml`                                       | Golden focus                                       |
| `.github/workflows/veracode-e2e.yml`                                           | Trusted-only E2E                                   |
| `.github/workflows/lab-quality.yml`                                            | Lab self-quality                                   |

---

## Negative tests (individual)

| File                                                    | Class       | Rationale                                                          |
| ------------------------------------------------------- | ----------- | ------------------------------------------------------------------ |
| `tests/negative/discovery/discovery-failures.test.js`   | KEEP_ACTION | Logic / temp dirs                                                  |
| `tests/negative/builder/builder-failures.test.js`       | KEEP_ACTION | Logic / temp                                                       |
| `tests/negative/config/config-failures.test.js`         | KEEP_ACTION | Logic                                                              |
| `tests/negative/dependency/auth-classification.test.js` | KEEP_ACTION | String classification                                              |
| `tests/negative/security/secret-leak.test.js`           | KEEP_ACTION | Logic                                                              |
| `tests/negative/doctor/*-failures.test.js`              | KEEP_ACTION | Ephemeral synthetic archives in temp — not committed golden corpus |
| `tests/negative/helpers/assert.js`                      | KEEP_ACTION | Shared helpers                                                     |

Committed invalid/golden binaries (if added later) live under Lab `invalid-artifacts/` / `golden-artifacts/`.

---

## Doctor unit vs Lab artifact

| Layer                                     | Location                                                 |
| ----------------------------------------- | -------------------------------------------------------- |
| Doctor rule unit tests                    | Action `tests/unit/` + negative doctor (synthetic)       |
| Doctor real / golden / contract artifacts | Lab `contracts/` + `golden-artifacts/` + `applications/` |

---

## Parity checklist (fill at Phase J)

```text
Tests before:            TBD
Action tests after:      TBD
Lab tests after:         TBD
Migrated:                TBD
Removed as duplicate:    0
Lost tests:              0
```

---

## Required status checks (Action)

| Check                  | Meaning                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------- |
| Local Gate             | Unit, negative, security, lint, Action Completeness                                     |
| Lab Compatibility Gate | Published by trusted `lab-orchestrator.yml` (main); never from PR code with App secrets |

Fork PR: Lab Compatibility = `PENDING_MAINTAINER_VALIDATION` (not PASS).
