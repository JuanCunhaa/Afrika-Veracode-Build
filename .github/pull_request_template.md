## Summary

<!-- O que mudou e por quê (1–3 bullets). -->

## Feature Completeness

Politica: [`docs/FEATURE-COMPLETENESS.md`](docs/FEATURE-COMPLETENESS.md) · SoT: [`schemas/capabilities.json`](schemas/capabilities.json) · Lab: [`docs/TEST-LAB.md`](docs/TEST-LAB.md)

Marque cada item. Use **N/A** com justificativa curta quando nao aplicavel.

### Action Completeness

- [ ] Official Veracode requirements reviewed (`docs/VERACODE-PACKAGING.md`)
- [ ] Discovery updated
- [ ] BuildPlan updated
- [ ] Builder/Packager implemented (or Build = N/A documented)
- [ ] Doctor implemented / rules tested
- [ ] Unit tests added
- [ ] Negative logic tests added (assert error **code**)
- [ ] Fingerprint updated (new manifests)
- [ ] Secret leak tests added when applicable
- [ ] `schemas/capabilities.json` updated (`actionValidation` + `labValidation`)
- [ ] `npm run check:completeness` PASS
- [ ] README updated (Supported / Compatibility / Limitations / Examples)
- [ ] CHANGELOG updated
- [ ] No secret values persisted (only env **names**)

### Lab Completeness (Afrika-Veracode-Build-Lab)

- [ ] Integration application added under `applications/…`
- [ ] Builder → Doctor contract updated
- [ ] Golden / invalid artifacts updated when applicable
- [ ] Test Matrix updated (`matrix/test-matrix.json`)
- [ ] Lab Completeness passes for this SHA
- [ ] Compatibility Matrix / expectations updated

N/A justifications (if any):

<!-- ex.: "Build N/A — SOURCE_PACKAGE JS/TS" -->

## Test plan

- [ ] `npm run format:check && npm run lint && npm test`
- [ ] `npm run check:action-pinning && npm run check:completeness`
- [ ] **Local Gate** green
- [ ] **Lab Compatibility Gate** green (same-repo PR/push; not fork)
- [ ] Fork PR: Lab check is `PENDING_MAINTAINER_VALIDATION` (not silent PASS)
