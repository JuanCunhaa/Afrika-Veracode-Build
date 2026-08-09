# Test Matrix

Last updated: 2026-08-08

Compatibility matrix **source of truth** lives in the private Lab:

[`Afrika-Veracode-Build-Lab/matrix/test-matrix.json`](https://github.com/JuanCunhaa/Afrika-Veracode-Build-Lab/blob/main/matrix/test-matrix.json)

Action capabilities declare `labValidation.matrixKey` in [`schemas/capabilities.json`](../schemas/capabilities.json). Lab Completeness verifies every Beta/Stable key has Full-profile coverage.

Resolver (Lab): `node scripts/resolve-test-matrix.js --profile pr|full|release`

Orchestration:

| Check                      | Workflow                                                                                           | Repo   |
| -------------------------- | -------------------------------------------------------------------------------------------------- | ------ |
| **Local Gate**             | [`ci.yml`](../.github/workflows/ci.yml)                                                            | Action |
| **Lab Compatibility Gate** | Lab `lab-gate.yml` via trusted [`lab-orchestrator.yml`](../.github/workflows/lab-orchestrator.yml) | Lab    |

See [`docs/TEST-LAB.md`](TEST-LAB.md) and [`docs/BRANCH-PROTECTION.md`](BRANCH-PROTECTION.md).

## Profiles

| Profile     | Trigger (Lab suite)                    | Goal                                              | fail-fast |
| ----------- | -------------------------------------- | ------------------------------------------------- | --------- |
| **pr**      | Same-repo PR / push (via orchestrator) | Fast representative coverage                      | `true`    |
| **full**    | schedule / manual / main as configured | All supported versions                            | `false`   |
| **release** | Trusted release path                   | Full + golden + contracts (+ E2E when configured) | `false`   |

Experimental cells may use `continue-on-error` in Lab. **Stable/Beta required** cells must not.

## PR Matrix (representative)

- Java Maven: 17 Basic, 21 Basic, Spring Boot 17
- Java Gradle: 17 Basic, 21 Basic
- JS: Node/npm, NestJS/yarn, Vue/pnpm
- TS: Node TS, React TSX
- .NET: 8 Console, 8 Web API, 10 Console (experimental)
- .NET Framework: 4.8 (windows)

## Ownership

| Concern                                         | Location |
| ----------------------------------------------- | -------- |
| Unit / negative logic / security                | Action   |
| Matrix rows / applications / contracts / golden | Lab      |
