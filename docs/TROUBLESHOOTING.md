# Troubleshooting

## DEPENDENCY_AUTH_REQUIRED

Restore falhou por autenticacao (ex.: NuGet `NU1301`, HTTP 401/403).

1. Identifique o registry privado no log.
2. Configure o secret no repositorio/org.
3. Exponha via `env:` no step da Action (nunca como input).

```yaml
env:
  NUGET_TOKEN: ${{ secrets.NUGET_TOKEN }}
```

## AMBIGUOUS_PROJECT

Discovery encontrou multiplos projetos elegiveis (ex.: varios `.sln`).

Informe `project_path` explicitamente.

## RUNNER_OS_INCOMPATIBLE

Projeto .NET Framework / MSBuild Windows detectado em runner Linux/macOS.

Use `windows-latest` (ou runner Windows self-hosted).

## CONFIG_STALE / fingerprint mudou

Manifests relevantes mudaram (pom, csproj, lockfile, etc.).
A Action rediscobre automaticamente em `config_mode=auto`.

## Doctor INVALID

Leia `.veracode-build/doctor-result.json` e os checks `FAIL`.
Corrija o packaging conforme `docs/VERACODE-PACKAGING.md`.

## Java sem debug

Status tipico: `READY_WITH_WARNINGS`.
Veracode analisa sem debug, mas line numbers podem faltar.

## Build failed generico

A Action deve emitir codigo estruturado. Se aparecer apenas "Build failed", abra issue interna — e um bug de UX.
