# Branch protection (Action repo)

Required status checks for `main` (and release branches if used):

| Check name                 | Source                                                                           | Meaning                                                                                  |
| -------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Local Gate**             | Workflow `CI` → job `local-gate` (`name: Local Gate`)                            | Action-local quality (lint, unit, negative, security, secret-leak, feature-completeness) |
| **Lab Compatibility Gate** | Workflow `Lab Orchestrator` → Checks API check run name `Lab Compatibility Gate` | Private Lab (`lab-gate.yml`) passed for the SHA (`pr` on PR / feature; `full` on main)   |

Configure under **Settings → Branches → Branch protection rules**:

1. Require status checks to pass before merging.
2. Require branches to be up to date (recommended).
3. Add both check names above exactly (case-sensitive for the Checks API name).

## Notes

- `Lab Compatibility Gate` is published automatically after every successful `CI` (feature push, PR, merge_group, main). It is **not** a job inside `ci.yml`.
- SHA alignment: feature push → branch HEAD; **pull_request → `refs/pull/<n>/merge`**; merge_group → group SHA; main → main tip. Local Gate and Lab Compatibility Gate must share that SHA (see [TEST-LAB.md](TEST-LAB.md)).
- While Lab runs, the check appears as **in_progress**; `details_url` links to the Lab workflow run when available.
- If Local Gate fails, Lab is not dispatched and `Lab Compatibility Gate` is published as **failure**.
- Draft PRs get **DRAFT_PR_LAB_DEFERRED** (failure) until `ready_for_review`.
- Fork PRs receive **PENDING_MAINTAINER_VALIDATION** (failure). See [TEST-LAB.md](TEST-LAB.md).
- Do not use a skipped/neutral Lab outcome as a required-pass substitute.
- Post-merge `full` on `main` does not undo a merge, but a failing main `full` means **main compatibility = BROKEN** and must block release until fixed.
- Stable release also requires Veracode E2E when that environment is enabled (separate check name **Veracode E2E**).

## Related

- [TEST-LAB.md](TEST-LAB.md) — App secrets, event policy, fork/draft, dedupe
- [FEATURE-COMPLETENESS.md](FEATURE-COMPLETENESS.md) — Action vs Lab validation split
