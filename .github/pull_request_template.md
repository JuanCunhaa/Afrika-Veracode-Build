## Summary

<!-- O que mudou e por quê (1–3 bullets). -->

## Feature Completeness

Politica: [`docs/FEATURE-COMPLETENESS.md`](docs/FEATURE-COMPLETENESS.md) · SoT: [`schemas/capabilities.json`](schemas/capabilities.json)

Marque cada item. Use **N/A** com justificativa curta quando nao aplicavel.

- [ ] Official Veracode requirements reviewed (`docs/VERACODE-PACKAGING.md`, `officialDocumentation` / `lastVerified`)
- [ ] Discovery updated
- [ ] BuildPlan updated
- [ ] Builder/Packager implemented (or Build = N/A documented)
- [ ] Doctor implemented / rules tested
- [ ] Unit tests added
- [ ] Negative tests added (assert error **code**)
- [ ] Integration fixture added (`tests/fixtures/integration/…`)
- [ ] Builder → Doctor contract added/updated
- [ ] Golden Artifacts added/updated
- [ ] Test Matrix updated (`tests/test-matrix.json`)
- [ ] Fingerprint updated (new manifests)
- [ ] Secret leak tests added when applicable
- [ ] `schemas/capabilities.json` updated (status + applicability)
- [ ] `npm run check:completeness` PASS
- [ ] README updated (Supported / Compatibility / Limitations / Examples)
- [ ] Compatibility Matrix updated
- [ ] CHANGELOG updated
- [ ] No secret values persisted (only env **names**)

N/A justifications (if any):

<!-- ex.: "Build N/A — SOURCE_PACKAGE JS/TS" -->

## Test plan

- [ ] `npm run format:check && npm run lint && npm test`
- [ ] `npm run check:action-pinning && npm run check:completeness`
- [ ] Relevant contract / matrix cells (if tech change)
- [ ] Gate job green on this PR
