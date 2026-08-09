# Test Lab (dual-repo)

Private quality lab: **`JuanCunhaa/Afrika-Veracode-Build-Lab`**.

Product Action repo (**Afrika-Veracode-Build**) runs **Local Gate** only (unit, negative, security, completeness). Compatibility corpus (integration apps, Builder→Doctor contracts, golden artifacts, matrix, Veracode E2E) runs in the Lab after a **trusted orchestrator** on the Action default branch dispatches `lab-gate.yml`.

Related: [BRANCH-PROTECTION](BRANCH-PROTECTION.md) · [TEST-MIGRATION-MAP](TEST-MIGRATION-MAP.md) · [FEATURE-COMPLETENESS](FEATURE-COMPLETENESS.md)

---

## Trusted orchestrator model

```text
PR / push → workflow CI (Local Gate)
                ↓ (workflow_run completed + success, same-repo)
         Lab Orchestrator (default-branch code only)
                ↓ GitHub App → workflow_dispatch lab-gate.yml
         Afrika-Veracode-Build-Lab
                ↓
         Check run: "Lab Compatibility Gate" on Action SHA
```

Rules:

- Orchestrator workflow (`.github/workflows/lab-orchestrator.yml`) **never** checks out PR head for execution of dispatch logic.
- Checkout uses `github.event.repository.default_branch` only.
- Lab App secrets live only on the Action repo (or org) and are passed into `scripts/lab/dispatch-and-wait.mjs` — never into untrusted PR workflows as reusable secrets for fork code.
- Script uses App JWT (RS256) + installation token; prefer **no** PAT.

### Automatic per-commit flow (default)

Open a PR (or push to `main`). Every commit that finishes **Local Gate** automatically triggers Lab Orchestrator via `workflow_run` — no manual dispatch.

| Event                              | Lab suite | Check on the commit SHA                                      |
| ---------------------------------- | --------- | ------------------------------------------------------------ |
| PR commit (`pull_request`)         | `pr`      | **Lab Compatibility Gate** (`in_progress` → success/failure) |
| Push to `main`                     | `full`    | same                                                         |
| Feature branch **without** open PR | —         | CI does not run (no Lab)                                     |

A new commit on the same branch cancels the previous in-flight Lab Orchestrator (`cancel-in-progress` by branch). If Local Gate fails, Lab is not dispatched and **Lab Compatibility Gate** is published as **failure** (not left pending).

`workflow_dispatch` is only for maintainer re-runs / fork validation after review.

---

## GitHub App setup

1. Create a GitHub App (org or user) dedicated to Lab dispatch.
2. Permissions (Lab repo only; do **not** grant broad org write):
   - **Metadata**: Read-only
   - **Actions**: Read and write (dispatch workflows, read runs/jobs)
3. Install the App on **`Afrika-Veracode-Build-Lab`** only.
4. Generate a private key (PEM). Store in Action repo secrets (never commit).

### Secrets (Action repository)

| Secret                           | Purpose                                                         |
| -------------------------------- | --------------------------------------------------------------- |
| `LAB_GITHUB_APP_ID`              | App ID                                                          |
| `LAB_GITHUB_APP_PRIVATE_KEY`     | PEM private key (`\n` escapes OK)                               |
| `LAB_GITHUB_APP_INSTALLATION_ID` | Optional; resolved via `GET /repos/{lab}/installation` if unset |

Env defaults used by `scripts/lab/dispatch-and-wait.mjs`:

- `LAB_OWNER=JuanCunhaa`
- `LAB_REPO=Afrika-Veracode-Build-Lab`
- `LAB_WORKFLOW_FILE=lab-gate.yml`
- `LAB_REF=main`
- `POLL_INTERVAL_MS=15000`
- `TIMEOUT_MS=3600000`

---

## Dispatch identity (`return_run_details` vs correlation fallback)

**Primary:** `POST .../actions/workflows/lab-gate.yml/dispatches` with body including `"return_run_details": true`. Prefer `workflow_run_id` from a **200** response and poll that exact run.

**Fallback only** when no `workflow_run_id` is returned (classic **204**): list recent `event=workflow_dispatch` runs created after dispatch and match `correlation_id` in `display_title` / `name`. The script logs clearly:

```text
LAB_RUN_LOOKUP_FALLBACK correlation_id=...
```

Lab `run-name` / titles should include `correlation_id` so fallback remains deterministic when two runs overlap.

Never log the private key, installation token, or `Authorization` header.

---

## Fork PR policy

Fork pull requests must **not** receive a green Lab check by skipping.

MVP behavior (Lab Orchestrator):

1. Detect `workflow_run.event == pull_request` and head repository is a fork (or different from Action repo).
2. Publish check run named exactly **`Lab Compatibility Gate`** with `conclusion: failure` and title/summary **`PENDING_MAINTAINER_VALIDATION`**.
3. Do **not** dispatch Lab with secrets in a way that trusts PR code; orchestrator still runs from default branch only.
4. After review, a maintainer re-runs **Lab Orchestrator** (`workflow_dispatch`) on the candidate SHA.

Required checks need `success` to pass branch protection — an explicit **failure** with `PENDING_MAINTAINER_VALIDATION` is intentional so a skip is never mistaken for PASS.

Future evolution may run Lab for fork SHAs from the trusted orchestrator without exposing secrets to PR workflows.

---

## Local development

```bash
# Unit tests for the dispatcher (mocked fetch; no network)
npm run test:unit
```

Manual dispatch (with App secrets in env):

```bash
export LAB_GITHUB_APP_ID=...
export LAB_GITHUB_APP_PRIVATE_KEY='-----BEGIN...'
export SOURCE_REPOSITORY=JuanCunhaa/Afrika-Veracode-Build
export SOURCE_SHA=<40-hex>
export SUITE=pr
export CORRELATION_ID=manual-$(date +%s)
node scripts/lab/dispatch-and-wait.mjs
```
