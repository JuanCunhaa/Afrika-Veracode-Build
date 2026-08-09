# Contributing

Este projeto e proprietario. Contribuicoes externas requerem autorizacao previa por escrito.

## Desenvolvimento interno

1. Use Node.js 20+.
2. Instale dependencias de desenvolvimento: `npm ci`.
3. Execute testes: `npm test` (unit + negative).
4. (Opcional) Coverage: `npm run test:coverage`. Suites isoladas: `npm run test:unit`, `npm run test:negative`.
5. Execute lint/format: `npm run lint` e `npm run format:check`.

## Unit / negative tests (este repositorio)

- Unit: `tests/unit/**` + fixtures em `tests/fixtures/unit/`.
- Negative: `tests/negative/**` — falhas esperadas com assertion de error code (nao apenas exit != 0).
- Escopo: Discovery, BuildPlan, Fingerprint, Config, Sanitize, Doctor rules (sem builds reais).
- CI local: `.github/workflows/ci.yml` → job **Local Gate**.

## Compatibility / Lab (repositorio privado)

Aplicacoes reais, Golden Artifacts, Builder → Doctor, matrix e Veracode E2E vivem em **Afrika-Veracode-Build-Lab**.
Ver [`docs/TEST-LAB.md`](docs/TEST-LAB.md) e [`docs/INTEGRATION-MATRIX.md`](docs/INTEGRATION-MATRIX.md).

Fluxo: Local Gate → Trusted Lab Orchestrator → Lab Gate → **Lab Compatibility Gate**.

## Regras

- **Feature Completeness (NO PARTIAL FEATURE):** Action Completeness + Lab Completeness. Ver [`docs/FEATURE-COMPLETENESS.md`](docs/FEATURE-COMPLETENESS.md) e `schemas/capabilities.json`. Antes do PR: `npm run check:completeness`.
- Nunca exponha `LAB_GITHUB_APP_*` a workflows do SHA do PR. So o orchestrator na default branch usa o App.
- Nao invente requisitos de packaging da Veracode. Consulte a documentacao oficial e atualize `docs/VERACODE-PACKAGING.md`.
- Mantenha modulos pequenos em `internal/<responsabilidade>/`.
- Adicione testes unitarios para Discovery, Fingerprint, Config, Sanitize e Doctor.
- Actions externas sempre com SHA completo.
- **Zero-secret-logging:** nunca persista ou logue valores de secrets. Use `internal/utils/sanitize/`. Ver `SECURITY.md`.
- Antes do PR: `npm run test:secret-leak` deve passar.
- Use o checklist do `.github/pull_request_template.md`. Issues de nova linguagem: `.github/ISSUE_TEMPLATE/new-language.yml`.
