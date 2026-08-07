# Afrika Veracode Build

## Overview

`Afrika-Veracode-Build` e uma GitHub Action proprietaria que prepara aplicacoes para Static Analysis da Veracode: discovery, toolchain, restore, build, packaging e validacao preflight (Doctor).

Ela **nao** substitui a [`Veracode-Connect`](https://github.com/Afrika-Tecnologia/Veracode-Connect). A responsabilidade termina no artifact Veracode-ready.

```text
Repository
  -> Afrika-Veracode-Build
  -> artifact (.veracode-build/analysisPack.zip)
  -> Veracode-Connect (Pipeline Scan / Upload & Scan / Gate)
  -> Veracode
```

## Problem

Onboarding SAST na Veracode falha com frequencia na **preparacao** do artifact: linguagem, runtime, wrapper, debug symbols, PDB, lockfiles, registries privados, exclusao de testes/`node_modules`, Blazor WASM, etc.

## Solution

A Action:

```text
detecta -> configura -> restaura -> compila/empacota -> valida -> memoriza configuracao
```

sempre que possivel em modo zero-config. Quando falha, emite codigo estruturado (`DEPENDENCY_AUTH_REQUIRED`, `AMBIGUOUS_PROJECT`, ...) com o que foi detectado e como corrigir.

## Architecture

Composite Action orquestradora + modulos em `internal/`:

- validate-inputs / resolve-repo
- discovery -> BuildPlan
- builder registry (Maven, Gradle, JS/TS, .NET)
- doctor registry
- config-store remoto atualizavel (fingerprint SHA-256)
- artifact + sanitize + summary

Detalhes: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Supported Technologies

| Technology    | Discovery | Build | Packaging |  Doctor |    MVP |
| ------------- | --------: | ----: | --------: | ------: | -----: |
| Java + Maven  |        ✅ |    ✅ |        ✅ |      ✅ |     ✅ |
| Java + Gradle |        ✅ |    ✅ |        ✅ |      ✅ |     ✅ |
| JavaScript    |        ✅ |   N/A |        ✅ |      ✅ |     ✅ |
| TypeScript    |        ✅ |   N/A |        ✅ |      ✅ |     ✅ |
| .NET C#       |        ✅ |    ✅ |        ✅ |      ✅ |     ✅ |
| .NET VB.NET   |        ✅ |    ✅ |        ✅ |      ✅ |     ✅ |
| ASP.NET       |        ✅ |    ✅ |        ✅ |      ✅ |     ✅ |
| Blazor WASM   |        ✅ |    ✅ |        ✅ |      ✅ |     ✅ |
| C++/CLI       |        🔎 |    ❌ |        ❌ | Parcial | Fase 2 |
| Xamarin/MAUI  |        🔎 |    ❌ |        ❌ | Parcial | Fase 2 |
| Python        |        ❌ |    ❌ |        ❌ |      ❌ | Fase 2 |

## How It Works

1. Valida inputs (`config_mode`, `doctor_mode`, auth de config)
2. Carrega Build Config remoto (se habilitado) e compara fingerprint
3. Discovery (ou reuse de config)
4. Setup de toolchain (SHA-pinned)
5. Restore + Build/Packaging
6. Doctor (requisitos **publicos** documentados)
7. Gera/atualiza Build Config
8. Outputs + `GITHUB_STEP_SUMMARY`

## Discovery

Detecta language, framework, runtime, buildSystem, packageManager, projectPath, strategy, required env **names**, confidence.

Ambiguidade (ex.: multiplos `.sln`) falha com `AMBIGUOUS_PROJECT`.

## Builder

- **Java Maven/Gradle:** Debug (source,lines,vars), wrappers, sem testes por default
- **JS/TS:** source package legivel — **sem** `npm run build` / minify / bundle
- **.NET moderno:** `dotnet publish -c Debug -p:UseAppHost=false`
- **.NET Framework/ASP.NET:** Windows + precompile
- **Blazor WASM:** `dotnet build` + `BlazorEnableCompression=false` (nao publish)

## Doctor

Preflight verificavel a partir da documentacao publica. **Nao** reproduz o prescan proprietario da Veracode.

Estados: `READY` | `READY_WITH_WARNINGS` | `INVALID` | `UNKNOWN`

Relatorio: `.veracode-build/doctor-result.json`

## Build Config

Repositorio proposto: `Afrika-Veracode-Build-Configs`  
Path: `{org}/{repo}/build-config.json`  
Atualizavel (nao write-once). Modes: `auto` | `refresh` | `readonly` | `disabled`.

Nunca persiste secret values — apenas nomes de variaveis.

Ver [docs/CONFIG-SCHEMA.md](docs/CONFIG-SCHEMA.md).

## Private Package Registries

Exponha tokens via `env:`:

```yaml
env:
  NUGET_TOKEN: ${{ secrets.NUGET_TOKEN }}
  NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
  MAVEN_USERNAME: ${{ secrets.MAVEN_USERNAME }}
  MAVEN_PASSWORD: ${{ secrets.MAVEN_PASSWORD }}
```

Nunca passe secret values em `build_command` / inputs.

## Inputs

Principais (lista completa em `action.yml`):

| Input                        | Default                           | Descricao                                    |
| ---------------------------- | --------------------------------- | -------------------------------------------- |
| `source`                     | `.`                               | Raiz do codigo                               |
| `project_path`               | `.`                               | Projeto relativo                             |
| `language`                   | `auto`                            | java / javascript / typescript / dotnet      |
| `java_package_mode`          | `compiled`                        | compiled \| source (sem fallback silencioso) |
| `run_tests`                  | `false`                           | Executa testes no build                      |
| `artifact_name`              | `analysisPack.zip`                | Nome do ZIP                                  |
| `artifact_output_dir`        | `.veracode-build`                 | Saida                                        |
| `artifact_path`              |                                   | Doctor-only mode                             |
| `config_mode`                | `auto`                            | auto/refresh/readonly/disabled               |
| `config_org` / `config_repo` | / `Afrika-Veracode-Build-Configs` | Config store                                 |
| `config_github_app_*`        |                                   | GitHub App preferencial                      |
| `config_github_token`        |                                   | PAT fallback                                 |
| `doctor_mode`                | `standard`                        | standard \| strict                           |
| `fail_on_doctor_warning`     | `false`                           | Falha em warnings                            |
| hooks `pre_*` / `*_command`  |                                   | Custom commands (trusted workflows)          |

## Outputs

`language`, `framework`, `runtime_version`, `build_system`, `package_manager`, `packaging_strategy`, `project_path`, `restore_status`, `build_status`, `artifact_path`, `artifact_name`, `artifact_status`, `doctor_status`, `doctor_warnings`, `config_source`, `config_status`, `config_path`, `required_env_vars`, `discovery_confidence`

## Examples

### Zero-config

```yaml
permissions:
  contents: read

jobs:
  prepare:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
      - name: Prepare Veracode Artifact
        id: veracode_build
        uses: JuanCunhaa/Afrika-Veracode-Build@<FULL_COMMIT_SHA>
```

### Private NuGet

```yaml
- name: Prepare Veracode Artifact
  id: veracode_build
  uses: JuanCunhaa/Afrika-Veracode-Build@<FULL_COMMIT_SHA>
  env:
    NUGET_TOKEN: ${{ secrets.NUGET_TOKEN }}
```

### Config Store (GitHub App)

```yaml
- uses: JuanCunhaa/Afrika-Veracode-Build@<FULL_COMMIT_SHA>
  with:
    config_mode: auto
    config_org: Afrika-Tecnologia
    config_github_app_id: ${{ secrets.BUILD_CONFIG_GITHUB_APP_ID }}
    config_github_app_private_key: ${{ secrets.BUILD_CONFIG_GITHUB_APP_PRIVATE_KEY }}
    config_github_app_installation_id: ${{ secrets.BUILD_CONFIG_GITHUB_APP_INSTALLATION_ID }}
```

## Integration with Veracode-Connect

```yaml
- name: Prepare Veracode Artifact
  id: veracode_build
  uses: JuanCunhaa/Afrika-Veracode-Build@<FULL_COMMIT_SHA>

- name: Veracode
  uses: Afrika-Tecnologia/Veracode-Connect@<FULL_COMMIT_SHA>
  with:
    enable_auto_packager: 'false'
    scan_file: ${{ steps.veracode_build.outputs.artifact_path }}
    veracode_api_id: ${{ secrets.VERACODE_API_ID }}
    veracode_api_key: ${{ secrets.VERACODE_API_KEY }}
```

## Development / Unit Tests

Requisitos: Node.js 20+.

```bash
npm ci
npm test                 # unit + negative (node:test)
npm run test:unit        # somente tests/unit
npm run test:negative    # somente tests/negative
npm run test:coverage    # coverage statement/branch (experimental)
npm run lint
npm run format:check
```

Os unit tests vivem em `tests/unit/` (discovery, build-plan, doctor, fingerprint, config, sanitize, utils) com fixtures em `tests/fixtures/unit/`. Os negative tests vivem em `tests/negative/` e provam falhas com error codes corretos (`UNSUPPORTED_LANGUAGE`, `AMBIGUOUS_PROJECT`, `DEPENDENCY_AUTH_REQUIRED`, `DOCTOR_FAILED`, …) e a distincao ERROR vs WARNING do Doctor. Sao rapidos, determinísticos e **nao** chamam a Veracode, registries externos nem credentials reais.

No CI, unit/negative rodam no job **Quality**; integration fixtures reais rodam em jobs paralelos (`java-maven`, `java-gradle`, `javascript`, `typescript`, `dotnet-modern`, `dotnet-framework`) do workflow unico [`.github/workflows/ci.yml`](.github/workflows/ci.yml). O veredito final e o job **Gate**. Matriz: [docs/INTEGRATION-MATRIX.md](docs/INTEGRATION-MATRIX.md).

## Security

- Least privilege: consumidores tipicos com `contents: read`
- Config store via GitHub App dedicado (Contents R/W apenas no repo de configs)
- SHA pinning de Actions externas
- Sem `curl | bash`
- Sem telemetria externa
- Codigo do repositorio escaneado deve ser confiavel antes de expor secrets de registry
- Evite `pull_request_target` + checkout de fork + secrets

Ver [SECURITY.md](SECURITY.md).

## Veracode Packaging References

Documentacao oficial usada pela Action: [docs/VERACODE-PACKAGING.md](docs/VERACODE-PACKAGING.md)

Last verified: **2026-08-07**

Termo de saida do Doctor:

> Veracode-ready according to documented packaging requirements

## Limitations

- Doctor nao substitui o prescan da Veracode
- Java source scan so com `java_package_mode=source` (sem fallback silencioso)
- .NET Framework / ASP.NET classico exigem runner Windows
- C++/CLI, Xamarin, MAUI: detectados como `NOT_IMPLEMENTED` (Fase 2)
- Custom commands executam shell arbitrario — use apenas em workflows confiaveis

## Roadmap

Fase 2 (estrategias previstas): PHP/Python/Perl/Apex/SQL/Classic ASP/COBOL/RPG/VB6 (`SOURCE_PACKAGE`); Scala/Groovy/Kotlin/Android/Apple/Dart/ColdFusion/Xamarin/MAUI (`BUILD_REQUIRED`); Go (`SOURCE_COMPILABLE`); C/C++ preprocess/binary; Ruby on Rails (`SPECIAL_PREPARATION`); React Native (`HYBRID`).

## License

Proprietary — Copyright (c) 2026 Juan Cunha. Ver [LICENSE](LICENSE).
