# Test Matrix

Last updated: 2026-08-07

Single source of truth: [`tests/test-matrix.json`](../tests/test-matrix.json).

Resolver: `node scripts/resolve-test-matrix.js --profile pr|full|release`

All matrices run inside the single workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml). **Gate** remains the only CI verdict (see `.cursor/rules/ci-gate.mdc`).

## Profiles

| Profile     | Trigger                                         | Goal                                                             | fail-fast |
| ----------- | ----------------------------------------------- | ---------------------------------------------------------------- | --------- |
| **pr**      | `pull_request`, `push` to `main`                | Fast representative coverage (ideally ≤10m)                      | `true`    |
| **full**    | `schedule` (weekly), `workflow_dispatch` → full | All supported versions / frameworks (non-cartesian)              | `false`   |
| **release** | `workflow_dispatch` → release                   | Unit + Negative + Security + PR + Full; then Release job may tag | `false`   |

Experimental cells use `continue-on-error`. **Stable** cells never do.

## Shards (Gate `needs`)

| Job                                                                                               | Role                                                     |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `resolve`                                                                                         | Emit matrices from `test-matrix.json`                    |
| `quality`                                                                                         | ESLint, Prettier, actionlint, yamllint                   |
| `unit`                                                                                            | Unit tests + coverage                                    |
| `negative`                                                                                        | Failure / error-code tests                               |
| `security`                                                                                        | Action SHA pinning                                       |
| `secret-leak`                                                                                     | Secret zero-leak suite (Gate blocker)                    |
| `feature-completeness`                                                                            | Feature Completeness Contract (`capabilities.json`)      |
| `java-maven` / `java-gradle` / `javascript` / `typescript` / `dotnet-modern` / `dotnet-framework` | Builder → Doctor contract                                |
| `gate`                                                                                            | Aggregate (skipped OK; failure/cancelled fail)           |
| `veracode-e2e`                                                                                    | Prepared stub (`if: false`) for future real Veracode E2E |

## PR Matrix (representative)

- Java Maven: 17 Basic, 21 Basic, Spring Boot 17
- Java Gradle: 17 Basic, 21 Basic
- JS: Node/npm, NestJS/yarn, Vue/pnpm
- TS: Node TS, React TSX
- .NET: 8 Console, 8 Web API, 10 Console (**experimental**)
- .NET Framework 4.8 on `windows-latest`
- OS: `ubuntu-latest` (+ Windows only when required)

## Full Compatibility (non-cartesian)

- **Runtime matrix:** Java 8–21 (25–26 experimental) × Maven Basic and Gradle Basic
- **Framework matrix (representative):** Spring Boot 17/21, WAR 17, multi-module 17, Kotlin DSL 17
- **JS/TS:** package managers + Node/Express/React/Next/Angular/Vue/Nest + TS/TSX fixtures
- **.NET modern:** 6–8 stable consoles; 9–10 experimental; project types on net8 (Web API, ASP.NET Core, classlib, Blazor experimental, VB, multi-project)
- **.NET Framework:** 4.8 Windows

## Release Matrix

`workflow_dispatch` with `matrix_profile=release` runs the union of PR + Full shards (plus quality/unit/negative/security). Gate must be green before the Release job creates `vX.Y.Z`.

Push to `main` still uses **pr** profile for day-to-day Gate speed; use **release** dispatch when cutting a thorough release validation.

## Cache

Maven (`setup-java` cache), Gradle (`setup-gradle`), npm (`setup-node` cache). No credentials/tokens/auth files in caches.

## Support summary

| Technology     | Versions         | Operating System | PR Tested                         | Full Tested                                     | Release Required | Stable / Experimental             |
| -------------- | ---------------- | ---------------- | --------------------------------- | ----------------------------------------------- | ---------------- | --------------------------------- |
| Java Maven     | 8, 11, 17, 21    | ubuntu-latest    | 17, 21 (+ Spring Boot 17)         | 8–21 + frameworks; 25–26 experimental           | yes              | Stable (25/26 Experimental)       |
| Java Gradle    | 8, 11, 17, 21    | ubuntu-latest    | 17, 21                            | 8–21 + Kotlin DSL; 25–26 experimental           | yes              | Stable (25/26 Experimental)       |
| JavaScript     | Node 20 (runner) | ubuntu-latest    | npm / yarn / pnpm reps            | Express, React, Next, Angular, Nest, Vue        | yes              | Stable                            |
| TypeScript     | Node 20 (runner) | ubuntu-latest    | Node TS, React TSX                | + Express TS, Next TSX                          | yes              | Stable                            |
| .NET (modern)  | 6, 7, 8          | ubuntu-latest    | 8 Console/WebAPI; 10 experimental | 6–8 + project types; 9–10 / Blazor experimental | yes              | Stable (9/10/Blazor Experimental) |
| .NET Framework | 4.8              | windows-latest   | 4.8                               | 4.8                                             | yes              | Stable                            |

Do **not** promote Experimental → Stable until that cell passes Full (or Release) without `continue-on-error`.

## Local

```bash
node scripts/resolve-test-matrix.js --profile pr --print-table
node scripts/resolve-test-matrix.js --profile full --print-support
npm run test:matrix
```
