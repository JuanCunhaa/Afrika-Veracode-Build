# Test Lab (dual-repo)

Private quality lab: **`JuanCunhaa/Afrika-Veracode-Build-Lab`**.

Product Action repo (**Afrika-Veracode-Build**) runs **Local Gate** only (unit, negative, security, completeness). Compatibility corpus (integration apps, Builder→Doctor contracts, golden via contracts) runs in the Lab after a **trusted orchestrator** on the Action default branch dispatches `lab-gate.yml`.

**Veracode Cloud E2E** is a separate trusted workflow in the Lab (`veracode-e2e.yml`) — not a Compatibility suite mode.

Related: [BRANCH-PROTECTION](BRANCH-PROTECTION.md) · [TEST-MIGRATION-MAP](TEST-MIGRATION-MAP.md) · [FEATURE-COMPLETENESS](FEATURE-COMPLETENESS.md) · [TEST-MATRIX](TEST-MATRIX.md)

---

## Trusted orchestrator model

```text
Code change
    │
    ▼
Local CI → Local Gate
    │ (workflow_run completed + success, same-repo)
    ▼
Trusted Lab Orchestrator (default-branch code only)
    │ GitHub App → lab-gate.yml (suite=pr|full)
    ▼
Private Lab: checkout Action SHA → real apps → Builder → Doctor
    │
    ▼
Check run: "Lab Compatibility Gate" on Action source_sha
```

Rules:

- Orchestrator (`.github/workflows/lab-orchestrator.yml`) **never** checks out PR head for dispatch logic.
- Checkout uses `github.event.repository.default_branch` only.
- Lab App secrets live only on the Action repo and are used only in the orchestrator — never in `ci.yml` / PR-head workflows.
- Checks API uses Action `GITHUB_TOKEN` on the trusted orchestrator only (`contents: read`, `checks: write`, `pull-requests: read`). App is installed on the **Lab** only (Actions R/W). Untrusted `ci.yml` stays `contents: read` (no `checks: write`).
- Script uses App JWT (RS256) + installation token; prefer **no** PAT.

---

## Compatibility suites (exactly two)

| Suite  | Purpose                                            |
| ------ | -------------------------------------------------- |
| `pr`   | Representative fast compatibility (matrix profile) |
| `full` | Complete officially declared compatibility matrix  |

Case counts come from Lab `matrix/test-matrix.json` (resolve with Lab `resolve-test-matrix.js`). Do not hardcode counts in product docs.

Release eligibility = **full** success on the candidate SHA + **Veracode E2E** when enabled — E2E is not `suite=full`.

### Limits (honest)

- Lab apps are **realistic laboratory fixtures**, not customer production repos.
- Compatibility Lab proves that SHA can process the known corpus (Discovery → BuildPlan → Builder → Artifact → Doctor) with real toolchains.
- It does **not** prove every app in the world is compatible.
- Normal compatibility tests use `CONFIG_MODE=disabled` (no remote config store).
- Lab Gate does **not** receive Veracode / private registry / Config Store / App credentials for Action-under-test execution.

---

## Event → suite + SHA policy (Branch Protection alignment)

Local Gate and Lab Compatibility Gate must be associated with the SHA GitHub expects for that event.

| Event                                   | Local Gate | Lab suite                    | SHA under test / check                                                                                      |
| --------------------------------------- | ---------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Push branch ≠ `main`                    | yes        | `pr`                         | **Feature HEAD** (`workflow_run.head_sha`)                                                                  |
| Pull request → `main`                   | yes        | `pr`                         | **PR merge commit** `refs/pull/<n>/merge` (same as CI `github.sha`) — **not** `pull_request.head.sha` alone |
| Draft PR                                | yes        | deferred                     | Merge SHA when resolvable; check **DRAFT_PR_LAB_DEFERRED**                                                  |
| Merge group → `main`                    | yes        | `pr`                         | **Merge group SHA**                                                                                         |
| Push `main`                             | yes        | `full`                       | **Main tip SHA**                                                                                            |
| Manual orchestrator `workflow_dispatch` | n/a        | `pr` or `full`               | Caller SHA (for PR re-validation prefer merge SHA)                                                          |
| Lab schedule (`full-matrix.yml`)        | —          | `full`                       | Action `main` HEAD                                                                                          |
| Release / tag                           | yes        | `full` then **Veracode E2E** | Candidate SHA; E2E is a separate gate                                                                       |

```text
FEATURE PUSH     → HEAD SHA      → Lab pr
PR → MAIN        → PR MERGE SHA  → Lab pr
MERGE GROUP      → GROUP SHA     → Lab pr
MAIN             → MAIN SHA      → Lab full
RELEASE / TAG    → Lab full → Veracode E2E → Release eligible
```

Implementation: `scripts/lab/resolve-source-sha.mjs` (unit-tested). Orchestrator resolves `GET .../git/ref/pull/<n>/merge` for `pull_request` events.

A new commit on the same branch cancels the previous in-flight Lab Orchestrator (`cancel-in-progress` by branch). If Local Gate fails, Lab is not dispatched and **Lab Compatibility Gate** is published as **failure** on the same policy SHA.

---

## Deduplication (same exact SHA + suite only)

Key: `JuanCunhaa/Afrika-Veracode-Build:<sha>:<suite>`

Before dispatch, reuse only when repository + **exact** SHA + suite match:

- **queued / in_progress** → wait on that run
- **success** → reuse
- **failure / cancelled** → allow a new dispatch

**Do not** dedupe feature-push HEAD against PR merge SHA — they differ by design:

- feature push validates the branch in isolation
- PR validates the integrated result with `main`

Never reuse `pr` for `full`.

---

## GitHub App setup

1. Create a GitHub App dedicated to Lab dispatch.
2. Permissions (Lab repo only):
   - **Metadata**: Read-only
   - **Actions**: Read and write
3. Install on **`Afrika-Veracode-Build-Lab`** only.
4. Store PEM in Action repo secrets (never commit).

Checks API uses Action `GITHUB_TOKEN` on the trusted orchestrator only (`contents: read`, `checks: write`, `pull-requests: read`). App is installed on the **Lab** only (Actions R/W). Untrusted `ci.yml` stays `contents: read` (no `checks: write`).

### Secrets (Action repository)

| Secret                           | Purpose                                                         |
| -------------------------------- | --------------------------------------------------------------- |
| `LAB_GITHUB_APP_ID`              | App ID                                                          |
| `LAB_GITHUB_APP_PRIVATE_KEY`     | PEM private key (`\n` escapes OK)                               |
| `LAB_GITHUB_APP_INSTALLATION_ID` | Optional; resolved via `GET /repos/{lab}/installation` if unset |

---

## Dispatch identity

**Primary:** `return_run_details: true` → `workflow_run_id` → poll exact run.

**Fallback only** on classic **204**: correlation_id in `display_title` / `name` (`LAB_RUN_LOOKUP_FALLBACK`).

Check **details_url** points at the Lab workflow run HTML URL when available.

Never log the private key, installation token, or `Authorization` header.

---

## Fork PR policy

1. Detect fork / foreign head repository on `pull_request`.
2. Publish **Lab Compatibility Gate** `failure` / **PENDING_MAINTAINER_VALIDATION**.
3. Maintainer re-runs Lab Orchestrator (`workflow_dispatch`) on the SHA after review.

---

## Draft PR policy

- Draft: Local Gate runs; Lab is **not** dispatched.
- Publish Lab Compatibility Gate **failure** titled **DRAFT_PR_LAB_DEFERRED**.
- On `ready_for_review`, CI + Lab `pr` run normally.

---

## Local development

```bash
npm run test:unit
npm run check:workflow-secrets
```

```bash
export LAB_GITHUB_APP_ID=...
export LAB_GITHUB_APP_PRIVATE_KEY='-----BEGIN...'
export SOURCE_REPOSITORY=JuanCunhaa/Afrika-Veracode-Build
export SOURCE_SHA=<40-hex>
export SUITE=pr
export CORRELATION_ID=manual-$(date +%s)
node scripts/lab/dispatch-and-wait.mjs
```
