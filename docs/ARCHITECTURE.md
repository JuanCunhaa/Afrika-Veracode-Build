# Architecture

## Visao geral

`Afrika-Veracode-Build` e uma GitHub Action composite que transforma codigo-fonte em um artifact alinhado aos requisitos publicos de packaging da Veracode.

Ela **nao** executa Pipeline Scan nem Upload & Scan. Esse papel permanece com `Afrika-Tecnologia/Veracode-Connect`.

```text
Repository
  -> Afrika-Veracode-Build (discover/build/package/doctor/remember)
  -> Veracode-ready artifact
  -> Veracode-Connect (scan/gate)
  -> Veracode
```

## Camadas

1. **Orchestrator** (`action.yml`) — coordena steps e outputs.
2. **Validate Inputs** — valida parametros e modos.
3. **Config Store** — carrega/salva `build-config.json` remoto (atualizavel).
4. **Fingerprint** — SHA-256 de manifests relevantes.
5. **Discovery** — detecta linguagem, runtime, build system e produz `DiscoveryResult`.
6. **BuildPlan** — plano normalizado consumido pelos builders.
7. **Builder Registry** — despacha para Maven, Gradle, JavaScript ou .NET.
8. **Artifact** — gera `.veracode-build/analysisPack.zip` (ou path nativo).
9. **Doctor Registry** — preflight baseado em regras documentadas.
10. **Summary** — logs agrupados, ASCII box e `GITHUB_STEP_SUMMARY`.

## Extensibilidade

Novos builders/doctors da Fase 2 devem ser adicionados como sub-actions em `internal/builder/<nome>` e `internal/doctor/<nome>`, registrados no dispatcher — sem switch gigante no root.

## Precedencia

```text
Explicit User Input > Valid Cached Config > Automatic Discovery
```

## Seguranca

- Secrets apenas via `env:`
- Build Config nunca armazena valores secretos
- Actions externas pinadas por SHA; sub-actions internas via `JuanCunhaa/Afrika-Veracode-Build/...@v{version}` (ver `npm run pr`)
- Sem telemetria externa no MVP
