# Contributing

Este projeto e proprietario. Contribuicoes externas requerem autorizacao previa por escrito.

## Desenvolvimento interno

1. Use Node.js 20+.
2. Instale dependencias de desenvolvimento: `npm ci`.
3. Execute testes unitarios: `npm test`.
4. (Opcional) Coverage: `npm run test:coverage`.
5. Execute lint/format: `npm run lint` e `npm run format:check`.

## Unit tests

- Local: `tests/unit/**` + fixtures em `tests/fixtures/unit/`.
- Escopo: Discovery, BuildPlan, Fingerprint, Config, Sanitize, Doctor rules (sem builds reais).
- CI: job Quality em `.github/workflows/ci.yml` (nao ha `quality.yml` separado); Gate e a fonte de verdade.

## Regras

- Nao invente requisitos de packaging da Veracode. Consulte a documentacao oficial e atualize `docs/VERACODE-PACKAGING.md`.
- Mantenha modulos pequenos em `internal/<responsabilidade>/`.
- Adicione testes unitarios para Discovery, Fingerprint, Config, Sanitize e Doctor.
- Actions externas sempre com SHA completo.
- Nunca persista secret values em Build Config, logs ou artifacts.
