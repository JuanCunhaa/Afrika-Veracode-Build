# Feature Completeness Policy

**NO PARTIAL FEATURE IMPLEMENTATION**

Politica arquitetural permanente de `Afrika-Veracode-Build`.

Uma capacidade so e considerada implementada quando o ciclo aplicavel esta completo.
Codigo parcial (ex.: so Discovery) **nao** conta como suporte oficial.

Source of truth declarativo: [`schemas/capabilities.json`](../schemas/capabilities.json)  
Validator automatico: `npm run check:completeness` (`tests/security/check-feature-completeness.js`)  
Codigo de falha: `FEATURE_COMPLETENESS_FAILED`

Relacionados: [ARCHITECTURE](ARCHITECTURE.md) · [TEST-LAB](TEST-LAB.md) · [BRANCH-PROTECTION](BRANCH-PROTECTION.md) · [TEST-MIGRATION-MAP](TEST-MIGRATION-MAP.md) · [TEST-MATRIX](TEST-MATRIX.md) · [BUILDER-DOCTOR-CONTRACT](BUILDER-DOCTOR-CONTRACT.md) · [VERACODE-PACKAGING](VERACODE-PACKAGING.md)

---

## Pergunta correta

Nunca: _"Python foi adicionado?"_

Sempre: _"Python passou pelo Feature Completeness Contract?"_

```text
RESEARCH → DISCOVERY → BUILD PLAN → BUILD/PACKAGE → DOCTOR
  → UNIT → NEGATIVE → INTEGRATION → BUILDER→DOCTOR
  → GOLDEN ARTIFACTS → TEST MATRIX → SECURITY
  → DOCUMENTATION → COMPATIBILITY MATRIX
  → VERACODE E2E → STABLE
```

---

## Status lifecycle

| Status           | Significado                                                                                  | Pode aparecer como suporte de producao? |
| ---------------- | -------------------------------------------------------------------------------------------- | --------------------------------------- |
| **Planned**      | So no roadmap / `capabilities.json`. Sem implementacao obrigatoria.                          | Nao                                     |
| **Experimental** | Implementacao parcial permitida. Gaps explicitos em `notes`.                                 | Nao                                     |
| **Beta**         | Ciclo interno completo (gates abaixo), sem E2E Veracode real suficiente.                     | Somente com aviso Beta                  |
| **Stable**       | Beta **mais** Veracode E2E real (Prescan accepted → Static Analysis Completed) + evidencias. | Sim                                     |

Promover para **Stable** exige `veracodeE2E: true` (e `labValidation.veracodeE2E: true`) em `capabilities.json`. Evidencia de E2E vive no Lab (`e2e/veracode/<id>/`), nao no Action repo.

Nunca declarar Stable se o Feature Completeness Report (Action + Lab) nao permitir.

---

## Applicability (evitar falsos positivos)

O validator e inteligente: nao exige Builder falso quando o packaging e `SOURCE_PACKAGE`.

Exemplo JavaScript:

| Gate      | Exigido                         |
| --------- | ------------------------------- |
| Build     | N/A (`buildRequired: false`)    |
| Packaging | Sim (`packagingRequired: true`) |
| Doctor    | Sim                             |
| Contract  | Sim                             |

Campos tipicos em `capabilities.json`:

- `buildRequired` / `packagingRequired`
- `discoveryDetector`, `builderPath`, `doctorModule`, `doctorProfiles`
- `unitGlobs`, `negativeRequired`, `contractFamily` (logical id for Lab)
- `actionValidation`: `{ unit, security, negativeLogic }`
- `labValidation`: `{ required, integrationSuite, contractSuite, goldenSuite, matrixKey, veracodeE2E }` — logical keys, not Action filesystem paths
- `fingerprintRelevant`, `veracodePackagingSection`, `readmeRow`
- `veracodeE2E`

**Action Completeness** (`npm run check:completeness`) valida discovery/builder/doctor/unit/negative/docs e que `labValidation` declara as chaves obrigatorias. Nao exige fixtures/contract/golden/matrix no disco do Action.

**Lab Completeness** (no Lab) valida o corpus real contra o `capabilities.json` do SHA da Action.

Frameworks novos (ex.: Quarkus) reusam Builder existente quando aplicavel — Discovery no Action; fixtures/matrix no Lab.

Modulos internos (ex.: Registry Auth Resolver) aplicam so gates relevantes (unit/negative/security/docs) — sem Golden Artifact burocratico no Action.

---

## Gates por tipo de mudanca

### Nova linguagem / tecnologia

1. **Fase 0 — Veracode requirements** (docs oficiais apenas) → `docs/VERACODE-PACKAGING.md` com `officialDocumentation` + `lastVerified`
2. Discovery (+ `DiscoveryResult` / schemas)
3. BuildPlan
4. Builder **ou** Packager (estrategia explicita; sem Builder falso)
5. Doctor (ERROR / WARNING / INFO corretos; nao afirmar prescan completo)
6. Unit tests (`tests/unit/discovery/<tech>/`, doctor) — Action
7. Negative tests (error **code**, nao so exit != 0) — Action
8. Integration apps no Lab (`applications/...`)
9. Builder → Doctor contract no Lab (`contracts/builder-doctor/...`)
10. Golden artifacts no Lab (`golden-artifacts/...`)
11. Test Matrix no Lab (`matrix/test-matrix.json`)
12. Fingerprint / Config schema se manifests novos — Action
13. Secret leak tests se credenciais/registries/HTTP — Action
14. README + Compatibility Matrix + CHANGELOG — Action
15. `schemas/capabilities.json` com `actionValidation` + `labValidation`
16. `npm run check:completeness` PASS (Action) + Lab Completeness PASS

Para **Stable**: + Veracode E2E real no Lab.

### Nova versao (ex.: Java 27)

Mesmo lifecycle de compatibilidade: detection, integration, Full Matrix, contract, README Tested Versions; E2E antes de Stable oficial.

### Nova Doctor rule

Unit PASS + Unit FAIL + negative quando aplicavel + golden quando aplicavel + doc/source. Nenhuma rule sem teste.

### Novo build system / packaging strategy

Discovery + Builder + Doctor compat + fixtures + negative + contract + matrix + docs.

### Remocao

Remover Discovery/Builder/Doctor/tests/fixtures/golden/matrix/capabilities/README/docs juntos — sem codigo morto.

### Breaking change

SemVer: inputs/outputs/BuildConfig/BuildPlan/artifact/status → major quando quebram consumidores.

### Bug fix

Sempre teste de regressao (Doctor→golden; Discovery→unit/fixture; Builder→integration/contract; secret→security negative).

---

## Definition of Done — Beta (linguagem)

- [ ] Requisitos Veracode oficiais registrados
- [ ] Discovery + BuildPlan
- [ ] Builder/Packager (ou Build=N/A documentado)
- [ ] Doctor
- [ ] Unit + Negative
- [ ] Integration apps no Lab
- [ ] Builder → Doctor contract PASS no Lab
- [ ] Golden artifacts no Lab
- [ ] Entrada Full na Test Matrix do Lab
- [ ] Fingerprint/schema quando aplicavel
- [ ] Secret tests quando aplicavel
- [ ] README + Compatibility + CHANGELOG + VERACODE-PACKAGING
- [ ] Entrada `beta` em `capabilities.json` com `labValidation`
- [ ] `check:completeness` PASS (Action)
- [ ] lint + **Local Gate** verde + **Lab Compatibility Gate** verde

## Definition of Done — Stable

Tudo de Beta **mais**:

- [ ] Veracode E2E (artifact → Prescan accepted → Static Analysis Completed) no Lab
- [ ] Evidencia sem secrets em Lab `e2e/veracode/<id>/`
- [ ] `status: stable` + `veracodeE2E: true` + `labValidation.veracodeE2E: true`

---

## CI gates (dual)

**Local Gate** (`CI` → job `local-gate`): quality, unit, negative, security, secret-leak, **feature-completeness** (Action Completeness).

**Lab Compatibility Gate** (Checks API via `Lab Orchestrator`): Lab `lab-gate.yml` for the SHA.

Branch protection must require both — see [BRANCH-PROTECTION.md](BRANCH-PROTECTION.md).

---

## Feature Completeness Report (obrigatorio ao finalizar capacidade)

```text
FEATURE COMPLETENESS REPORT

Feature: <nome>
Veracode Requirements: PASS | FAIL | N/A
Discovery: ...
BuildPlan: ...
Builder/Packager: ...
Doctor: ...
Unit Tests: ...
Negative Tests: ...
Integration: ...
Builder → Doctor: ...
Golden Artifacts: ...
Test Matrix: ...
Fingerprint: ...
Secret Leak: PASS | N/A | FAIL
README: ...
Compatibility Matrix: ...
CHANGELOG: ...
Veracode E2E: PASS | NOT EXECUTED | FAIL
Final Status: PLANNED | EXPERIMENTAL | BETA | STABLE
```

---

## Templates

- PR: `.github/pull_request_template.md` (checklist Feature Completeness; N/A exige justificativa)
- Issue nova linguagem: `.github/ISSUE_TEMPLATE/new-language.yml`
