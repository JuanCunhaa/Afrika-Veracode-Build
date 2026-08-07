# Build Config Schema

Schema version atual: `1`

Arquivo remoto:

```text
{config_org}/{config_repo}/{owner}/{repo}/build-config.json
```

Default `config_repo`: `Afrika-Veracode-Build-Configs`

## Exemplo

```json
{
  "schemaVersion": 1,
  "repository": "company/application",
  "projectPath": ".",
  "discovery": {
    "language": "java",
    "framework": "spring-boot",
    "runtimeVersion": "17",
    "buildSystem": "maven",
    "packageManager": "maven",
    "projectType": "web",
    "confidence": "HIGH"
  },
  "builder": {
    "strategy": "BUILD_REQUIRED",
    "wrapper": "./mvnw",
    "artifactPatterns": ["target/*.jar"],
    "runTests": false
  },
  "dependencies": {
    "privateRegistryDetected": true,
    "requiredEnvironmentVariables": ["MAVEN_USERNAME", "MAVEN_TOKEN"]
  },
  "doctor": {
    "profile": "java-compiled"
  },
  "fingerprint": {
    "algorithm": "sha256",
    "value": "..."
  },
  "generatedBy": {
    "action": "Afrika-Veracode-Build",
    "actionVersion": "0.1.0"
  },
  "updatedAt": "2026-08-07T00:00:00.000Z"
}
```

## Proibicoes

Nunca armazenar:

- password, token, PAT, private key, API key
- valores de `NUGET_TOKEN`, `NPM_TOKEN`, `MAVEN_PASSWORD`, etc.

Pode armazenar apenas o **nome** da variavel em `requiredEnvironmentVariables`.

## Modes (`config_mode`)

| Mode       | Comportamento                                              |
| ---------- | ---------------------------------------------------------- |
| `auto`     | Usa config se fingerprint ok; senao descobre e salva       |
| `refresh`  | Ignora discovery cache; rediscover e atualiza apos sucesso |
| `readonly` | Pode ler; nao cria/atualiza                                |
| `disabled` | Nao consulta nem persiste remoto                           |

## Atualizacao

Build Config e atualizavel (diferente do Repo Baseline write-once).
Updates usam SHA da Contents API; em HTTP 409: re-GET + um retry; se persistir, falha com `CONFIG_WRITE_FAILED`.
