# DUAL REPOSITORY MIGRATION REPORT

Date: 2026-08-08  
Branches: Action `feat/dual-repo-lab-gate` · Lab `main`

---

## Repositories

| Repository                    | Status                                                                                  |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| **Afrika-Veracode-Build**     | Feature branch ready (`feat/dual-repo-lab-gate`); Local Gate + Trusted Lab Orchestrator |
| **Afrika-Veracode-Build-Lab** | **PRIVATE**, default branch `main` established and pushed                               |

## Git Remote

| Repo   | Remote                                                        | Notes                                                |
| ------ | ------------------------------------------------------------- | ---------------------------------------------------- |
| Lab    | `https://github.com/JuanCunhaa/Afrika-Veracode-Build-Lab.git` | Pushed; SSH failed initially → HTTPS used            |
| Action | `https://github.com/JuanCunhaa/Afrika-Veracode-Build.git`     | Branch committed locally; push pending your approval |

## Repository Privacy

| Repo                      | Visibility                       |
| ------------------------- | -------------------------------- |
| Afrika-Veracode-Build     | PUBLIC (product)                 |
| Afrika-Veracode-Build-Lab | **PRIVATE** (confirmed via `gh`) |

---

## Migrated Tests

| Corpus                     | Count (files) | Destination                     |
| -------------------------- | ------------: | ------------------------------- |
| Integration applications   |           144 | Lab `applications/`             |
| Golden artifacts           |             8 | Lab `golden-artifacts/`         |
| Builder → Doctor contracts |             6 | Lab `contracts/builder-doctor/` |
| Test matrix                |             1 | Lab `matrix/test-matrix.json`   |
| E2E placeholder            |             1 | Lab `e2e/veracode/`             |
| Matrix unit tests          |       6 cases | Lab `tests/unit/matrix/`        |

## Tests Remaining in Action

| Suite          | Approx files | Notes                                                            |
| -------------- | -----------: | ---------------------------------------------------------------- |
| Unit           |           17 | Includes relocated contract helper lib + dispatch-and-wait mocks |
| Security       |            3 | Pinning + Action Completeness + secret-leak                      |
| Negative logic |            9 | Logic + ephemeral synthetic archives                             |
| Unit fixtures  |           95 | Small parse fixtures kept                                        |

---

## Cross Repository

| Concern                                             | Status                                |
| --------------------------------------------------- | ------------------------------------- |
| Dispatch (`return_run_details` → `workflow_run_id`) | Implemented                           |
| Correlation ID (audit + fallback)                   | Implemented                           |
| Polling / timeout / cancel / failure                | Implemented + mocked                  |
| Result → Lab Compatibility Gate check               | Implemented in `lab-orchestrator.yml` |
| Trusted orchestrator (no App secrets on PR)         | Implemented                           |
| Gate Integration (live)                             | **PENDING** secrets                   |

---

## Security

| Control                                           | Status               |
| ------------------------------------------------- | -------------------- |
| SHA pinning (Action + Lab workflows)              | PASS (static)        |
| Secrets never in logs (orchestrator tests)        | PASS (mocked)        |
| Untrusted PR isolation (no Lab App on CI)         | PASS (static design) |
| Fork = `PENDING_MAINTAINER_VALIDATION` (not PASS) | PASS (static)        |
| `config_mode: disabled` in Lab compatibility      | PASS (static)        |
| Veracode E2E trusted-only / separate workflow     | PASS (static)        |

---

## Test Migration Parity

```text
MIGRATION TEST PARITY

Integration apps before/after:     144 → Lab 144 / Action 0
Golden artifacts before/after:     8 → Lab 8 / Action 0
Contract suite files before/after: 6 → Lab 6 (+ helper kept in Action unit/)
Matrix SoT:                        Action → Lab
E2E placeholder:                   Action → Lab
Matrix unit tests:                 Action → Lab (6 tests PASS)

Removed as duplicate:              0
Lost tests:                        0
```

---

## Validation tiers

### Validated locally

- Action: `npm run test:unit` → **121 pass**
- Action: `npm run test:negative` → **42 pass**
- Action: `npm run check:completeness` → **PASS**
- Action: `npm run check:action-pinning` → **PASS**
- Action: `npm run lint` → **PASS**
- Lab: `validate-lab-completeness.mjs` with `ACTION_ROOT` → **PASS**
- Lab: matrix unit tests → **6 pass**
- Lab: `check-action-pinning` → **PASS**
- Lab: matrix resolve `--profile pr` → **PASS**

### Validated through mocks

- `dispatch-and-wait`: run_id primary poll, correlation fallback, dual-run race, wrong id/correlation, cancelled, timeout, failure, auth failure, secret non-leak, JWT creation

### Validated statically

- Lab workflows SHA-pinned; allowlist `JuanCunhaa/Afrika-Veracode-Build`
- `lab-orchestrator.yml` checks out **default branch only**
- `ci.yml` has **no** `LAB_GITHUB_APP_*` secrets
- Required check names: **Local Gate**, **Lab Compatibility Gate**
- Lab privacy PRIVATE

### Live validation pending

See **LIVE INTEGRATION PENDING** below.

---

## Final Gate model

```text
Local Gate (CI)              REQUIRED
Lab Compatibility Gate       REQUIRED  (trusted orchestrator)
```

Future evolution (documented in `docs/BRANCH-PROTECTION.md`): optional synthetic single check without exposing App key to PR code.

---

## LIVE INTEGRATION PENDING

Exact steps for the first real cross-repository Gate:

1. **Create GitHub App** named conceptually `Afrika-Veracode-Build-Lab-Gate`
   - Permissions on Lab: **Metadata: Read-only**, **Actions: Read and write**
   - Install **only** on `JuanCunhaa/Afrika-Veracode-Build-Lab`
2. **Add Action repository secrets** (never on Lab PR jobs):
   - `LAB_GITHUB_APP_ID`
   - `LAB_GITHUB_APP_PRIVATE_KEY`
   - `LAB_GITHUB_APP_INSTALLATION_ID` (optional if auto-resolve works)
3. Confirm Lab `main` contains `.github/workflows/lab-gate.yml` (done).
4. Push / open PR for Action branch `feat/dual-repo-lab-gate`.
5. Configure branch protection required checks:
   - `Local Gate`
   - `Lab Compatibility Gate`
6. Run same-repo PR or push: Local Gate success → Orchestrator → Lab Gate → check on SHA.
7. Optionally force a Lab failure once to prove Action check fails.
8. Do **not** enable Veracode E2E until environment `veracode-e2e` + credentials exist.

**Not done in this stage (by design):** live App auth, live dispatch, live Lab matrix builds against a remote SHA.
