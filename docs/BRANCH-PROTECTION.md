# Branch protection (Action repo)

Required status checks for `main` (and release branches if used):

| Check name                 | Source                                                                           | Meaning                                                                                  |
| -------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Local Gate**             | Workflow `CI` → job `local-gate` (`name: Local Gate`)                            | Action-local quality (lint, unit, negative, security, secret-leak, feature-completeness) |
| **Lab Compatibility Gate** | Workflow `Lab Orchestrator` → Checks API check run name `Lab Compatibility Gate` | Private Lab (`lab-gate.yml`) passed for the SHA                                          |

Configure under **Settings → Branches → Branch protection rules**:

1. Require status checks to pass before merging.
2. Require branches to be up to date (recommended).
3. Add both check names above exactly (case-sensitive for the Checks API name).

## Notes

- `Lab Compatibility Gate` is published automatically by the trusted orchestrator after every `CI` completion (same-repo PR commit or push to `main`). It is **not** a job inside `ci.yml`.
- While Lab runs, the check appears as **in_progress** on the commit; then success or failure.
- If Local Gate fails, Lab is not dispatched and `Lab Compatibility Gate` is published as **failure** (so the required check does not stay pending forever).
- Fork PRs receive `Lab Compatibility Gate` with **failure** / `PENDING_MAINTAINER_VALIDATION` (see [TEST-LAB.md](TEST-LAB.md)). That is intentional: do not remove the Lab check from required list to “make forks green.”
- Do not use a skipped/neutral Lab outcome as a required-pass substitute.

## Related

- [TEST-LAB.md](TEST-LAB.md) — App secrets, dispatch, fork policy
- [FEATURE-COMPLETENESS.md](FEATURE-COMPLETENESS.md) — Action vs Lab validation split
