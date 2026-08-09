# EVENT / GATE VALIDATION REPORT

Date: 2026-08-09  
Action branch: `feat/lab-orchestrator-auto-checks` (PR #6)  
Lab branch: `feat/pr-full-suites` (Lab PR #1)

## Policy (implemented)

```text
FEATURE BRANCH PUSH → Local + Lab pr   (SHA = feature HEAD)
PR → MAIN            → Local + Lab pr   (SHA = refs/pull/<n>/merge)
MERGE GROUP          → Local + Lab pr   (SHA = merge group)
MAIN                 → Local + Lab full (SHA = main tip)
RELEASE / TAG        → Lab full → Veracode E2E → Release eligible
```

`full` and **Veracode E2E** are different validations. E2E is never a Compatibility suite mode.

Feature-push HEAD and PR merge SHA are **not** deduped against each other (intentional double validation).

## Matrix counts (from Lab SoT)

| Suite    | Cases |
| -------- | ----- |
| **pr**   | 14    |
| **full** | 40    |

Lost tests from removing `release` suite: **0**.

## Validation status

| Layer                                                                      | Status                       |
| -------------------------------------------------------------------------- | ---------------------------- |
| Unit tests (suite mapping + SHA policy + dispatcher/dedupe)                | **Validated locally**        |
| Workflow secret policy (`ci.yml` has no Lab/Veracode secrets)              | **Validated locally**        |
| Orchestrator permissions (contents:read, checks:write, pull-requests:read) | **Validated statically**     |
| Live feature push → Lab pr PASS                                            | **Live integration pending** |
| Live PR → main → Lab pr PASS (merge SHA)                                   | **Live integration pending** |
| Live intentional Lab fail → PR blocked                                     | **Live integration pending** |
| Live main → Lab full PASS                                                  | **Live integration pending** |
| Live new commit → prior check not reused                                   | **Live integration pending** |

Do **not** mark the five live scenarios above as validated until executed on GitHub.

## Event / Gate table

| Event                        | Local        | Lab                | Suite        | SHA                   | Live result       |
| ---------------------------- | ------------ | ------------------ | ------------ | --------------------- | ----------------- |
| feature branch push          | Implemented  | Orchestrator → Lab | `pr`         | feature HEAD          | Pending           |
| PR → main                    | Implemented  | Orchestrator → Lab | `pr`         | PR merge              | Pending           |
| same feature HEAD + PR merge | Both run     | No cross-dedupe    | `pr`         | different SHAs        | By design         |
| main push                    | Implemented  | Orchestrator → Lab | `full`       | main tip              | Pending           |
| merge_group                  | Implemented  | Orchestrator → Lab | `pr`         | group SHA             | Pending           |
| draft PR                     | Local only   | Deferred check     | —            | merge when resolvable | Static            |
| Release / Tag                | Local + Lab  | then E2E           | `full` + E2E | candidate             | Pending (E2E env) |
| manual pr / full             | Orchestrator | Lab                | `pr`/`full`  | caller SHA            | Mocks + inputs    |

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
Secret leaks: 0
GitHub App install: Lab only (Actions)
Check publish: Action GITHUB_TOKEN (checks:write) on trusted orchestrator only
CI (untrusted/PR code path): contents:read only — no checks:write
```

## Next step

**LIVE INTEGRATION VALIDATION** on GitHub (after merge of Action #6 + Lab #1 as needed):

1. feature push → pr PASS
2. PR → main → pr PASS (verify check SHA = merge commit)
3. intentional Lab fail → PR BLOCKED
4. main → full PASS
5. new commit → previous check not reused for the new SHA
