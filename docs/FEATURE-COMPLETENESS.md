# Feature Completeness Policy

**NO PARTIAL FEATURE IMPLEMENTATION**

Politica arquitetural permanente de `Afrika-Veracode-Build`.

Uma capacidade so e considerada implementada quando o ciclo aplicavel esta completo.
Codigo parcial (ex.: so Discovery) **nao** conta como suporte oficial.

Source of truth declarativo: [`schemas/capabilities.json`](../schemas/capabilities.json)  
Validator automatico: `npm run check:completeness` (`tests/security/check-feature-completeness.js`)  
Codigo de falha: `FEATURE_COMPLETENESS_FAILED`

Relacionados: [ARCHITECTURE](ARCHITECTURE.md) · [TEST-MATRIX](TEST-MATRIX.md) · [BUILDER-DOCTOR-CONTRACT](BUILDER-DOCTOR-CONTRACT.md) · [VERACODE-PACKAGING](VERACODE-PACKAGING.md)

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

Promover para **Stable** exige `veracodeE2E: true` em `capabilities.json` e evidencia em `tests/e2e/veracode/<id>/RESULT.md` (sem secrets/findings sensiveis).

Nunca declarar Stable se o Feature Completeness Report nao permitir.

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
- `unitGlobs`, `negativeRequired`, `contractFamily`
- `integrationFixtureRoot`, `goldenArtifactsRoot`, `testMatrixKey`
- `fingerprintRelevant`, `veracodePackagingSection`, `readmeRow`
- `veracodeE2E`

Frameworks novos (ex.: Quarkus) reusam Builder existente quando aplicavel — so Discovery/fixtures/matrix/docs extras.

Modulos internos (ex.: Registry Auth Resolver) aplicam so gates relevantes (unit/negative/integration/security/docs) — sem Golden Artifact burocratico.

---

## Gates por tipo de mudanca

### Nova linguagem / tecnologia

1. **Fase 0 — Veracode requirements** (docs oficiais apenas) → `docs/VERACODE-PACKAGING.md` com `officialDocumentation` + `lastVerified`
2. Discovery (+ `DiscoveryResult` / schemas)
3. BuildPlan
4. Builder **ou** Packager (estrategia explicita; sem Builder falso)
5. Doctor (ERROR / WARNING / INFO corretos; nao afirmar prescan completo)
6. Unit tests (`tests/unit/discovery/<tech>/`, doctor)
7. Negative tests (error **code**, nao so exit != 0)
8. Integration fixture real (`tests/fixtures/integration/<tech>/`)
9. Builder → Doctor contract
10. Golden artifacts (podem ser gerados deterministicamente)
11. Test Matrix (`tests/test-matrix.json` — PR representative, Full complete)
12. Fingerprint / Config schema se manifests novos
13. Secret leak tests se credenciais/registries/HTTP
14. README + Compatibility Matrix + CHANGELOG
15. `schemas/capabilities.json` atualizado
16. `npm run check:completeness` PASS

Para **Stable**: + Veracode E2E real.

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
- [ ] Integration fixture
- [ ] Builder → Doctor contract PASS
- [ ] Golden artifacts root
- [ ] Entrada Full na Test Matrix
- [ ] Fingerprint/schema quando aplicavel
- [ ] Secret tests quando aplicavel
- [ ] README + Compatibility + CHANGELOG + VERACODE-PACKAGING
- [ ] Entrada `beta` em `capabilities.json`
- [ ] `check:completeness` PASS
- [ ] lint + Gate CI verde

## Definition of Done — Stable

Tudo de Beta **mais**:

- [ ] Veracode E2E (artifact → Prescan accepted → Static Analysis Completed)
- [ ] Evidencia sem secrets em `tests/e2e/veracode/<id>/`
- [ ] `status: stable` + `veracodeE2E: true`

---

## CI Gate

Job **`feature-completeness`** no workflow unico `CI` (`.github/workflows/ci.yml`):

- Roda em paralelo nos perfis PR / push main / full / release
- Entra em `gate.needs`
- Release nao passa se Stable declarado estiver incompleto

Veredito final do CI continua sendo o job **Gate**.

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
