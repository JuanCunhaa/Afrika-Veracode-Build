# Veracode real E2E evidence

Evidence that an artifact produced by Afrika-Veracode-Build was accepted by Veracode
(Prescan → Static Analysis → Completed) lives under:

```text
tests/e2e/veracode/<capability-id>/RESULT.md
```

Rules:

- No API secrets, tokens, or confidential findings in git.
- Record only: capability id, date, runner OS, artifact kind, outcome (accepted/completed), and non-sensitive scan id if needed.
- Required for `status: stable` in [`schemas/capabilities.json`](../../schemas/capabilities.json).
- Until real E2E runs, capabilities remain at most **beta** (`veracodeE2E: false`).

See [`docs/FEATURE-COMPLETENESS.md`](../../docs/FEATURE-COMPLETENESS.md).
