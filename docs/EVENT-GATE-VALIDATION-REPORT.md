# EVENT / GATE VALIDATION REPORT

Date: 2026-08-09  
Action branch: `feat/lab-orchestrator-auto-checks` (PR #6 expansion)  
Lab branch: `feat/pr-full-suites`

## Policy (implemented)

```text
FEATURE BRANCH PUSH → Local + Lab pr
PR → MAIN            → Local + Lab pr
MAIN                 → Local + Lab full
RELEASE              → Lab full + Veracode E2E (separate)
```

## Matrix counts (from Lab SoT)

Resolved locally after Lab changes:

| Suite    | Cases |
| -------- | ----- |
| **pr**   | 14    |
| **full** | 40    |

Lost tests from removing `release` suite: **0** (every former release row already had `full`).

## Validation status

| Layer                                              | Status                                               |
| -------------------------------------------------- | ---------------------------------------------------- |
| Unit tests (Action lab dispatcher + suite mapping) | **Validated locally** (17 pass)                      |
| Workflow secret policy                             | **Validated locally**                                |
| Matrix unit tests (Lab)                            | **Validated locally** (expected)                     |
| Live feature push → Lab pr                         | **Live integration pending** (after merge)           |
| Live PR → Lab pr / dedupe                          | **Live integration pending**                         |
| Live main → Lab full                               | **Live integration pending**                         |
| Manual pr / full                                   | **Validated through mocks** + static workflow inputs |

## Event / Gate table (target vs implementation)

| Event               | Local                           | Lab                            | Suite  | Result            |
| ------------------- | ------------------------------- | ------------------------------ | ------ | ----------------- |
| feature branch push | Implemented (`ci.yml` push all) | Orchestrator → Lab             | `pr`   | Pending live      |
| PR → main           | Implemented                     | Orchestrator → Lab             | `pr`   | Pending live      |
| same SHA push+PR    | Implemented (dedupe)            | Reuse success / wait in-flight | `pr`   | Mocked unit       |
| main push           | Implemented                     | Orchestrator → Lab             | `full` | Pending live      |
| merge_group         | Implemented (`ci.yml`)          | Orchestrator → Lab             | `pr`   | Pending live      |
| draft PR            | Local only                      | Deferred check                 | —      | Static + workflow |
| manual pr           | Orchestrator dispatch           | Lab                            | `pr`   | Inputs + mocks    |
| manual full         | Orchestrator dispatch           | Lab                            | `full` | Inputs + mocks    |

## PR SUITE

```text
Cases: 14
Duration: Live integration pending
Result: Live integration pending
```

## FULL SUITE

```text
Cases: 40
Duration: Live integration pending
Result: Live integration pending
```

## SECURITY

```text
Untrusted code with GitHub App secret: 0
Untrusted code with Veracode secret: 0
Secret leaks: 0 (policy: ci.yml forbidden; only lab-orchestrator.yml may use LAB_GITHUB_APP_*)
```

## Notes

- Checks published with Action `GITHUB_TOKEN`; App installed on Lab only.
- Compatibility Lab uses realistic laboratory apps + real toolchains; not customer repos; not Veracode Cloud.
- `CONFIG_MODE=disabled` on Lab Gate contracts.
