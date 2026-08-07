# Security Policy

## Reporting a Vulnerability

Nao abra issues publicas com detalhes de vulnerabilidades sensiveis.

Reporte vulnerabilidades de forma privada para:

`SECURITY_CONTACT_EMAIL_PLACEHOLDER`

Substitua este placeholder pelo canal oficial de security da Afrika Tecnologia antes do uso em producao.

Inclua:

- descricao do problema;
- impacto potencial;
- passos para reproduzir (quando seguro);
- versao/tag/SHA afetado.

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | yes       |

## Secret Handling

Afrika-Veracode-Build follows a **zero-secret-logging** policy.

Credentials and secret values must **never** be written to:

- GitHub Actions logs (stdout/stderr/debug)
- exception messages or stack traces
- `GITHUB_STEP_SUMMARY`
- Discovery / Doctor / Build / Config reports (`.veracode-build/*.json`)
- Build Config remoto (`build-config.json`)
- temporary logs or test captures

Only **secret / environment variable names** may be persisted when necessary (example: `requiredEnvironmentVariables: ["NUGET_TOKEN"]`).

### Defense in depth

1. `::add-mask::` via `registerSecret()` / `registerSecretsFromEnv()` when values are known
2. Application sanitization (`internal/utils/sanitize/`) for all logs, errors, commands, URLs and objects
3. No secret persistence (`writeJson` / config scrub)

Central module: `internal/utils/sanitize/sanitize.js` (`sanitizeText`, `sanitizeError`, `sanitizeCommand`, `sanitizeObject`, `registerSecret`).

**Contributors:** any new code that touches credentials, auth headers, subprocess output, or remote config **must** use this module. Do not invent ad-hoc masking.

Synthetic secret-leak suite (Gate): `tests/security/secret-leak/` — `npm run test:secret-leak`.

### Prohibitions

- Never log `env` / `printenv` / `process.env`
- Never print Authorization / Cookie / X-API-Key header values
- Never print URLs with embedded credentials or `?token=` query values
- Never print expanded CLI passwords (`--password <secret>`)

## Dependency and Supply-Chain Policy

- Actions externas devem ser pinadas por SHA completo de 40 caracteres do repositorio original.
- Nao use `@main`, `@master` ou `@latest` para dependencias de Actions.
- Nao use `curl | bash` para instalar ferramentas.
- Prefira versoes fixas e checksums quando disponiveis.
- Dependencias npm de desenvolvimento devem ser versionadas de forma explicita.

## Workflow Least Privilege

Consumidores tipicos precisam apenas:

```yaml
permissions:
  contents: read
```

Acesso ao repositorio central de Build Config deve usar GitHub App dedicado com:

- Contents: Read and write
- Metadata: Read-only

somente no repositorio de configs.

## Pull request security checklist

- [ ] New code does not log environment variables.
- [ ] New code does not persist credentials.
- [ ] Sensitive subprocess output is sanitized.
- [ ] Secret-leak tests cover new authentication flows.
