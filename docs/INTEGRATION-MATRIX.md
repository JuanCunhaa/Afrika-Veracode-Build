# Integration fixtures matrix

Last updated: 2026-08-07

Integration fixtures live under `tests/fixtures/integration/`.
CI jobs select cases from [`tests/test-matrix.json`](../tests/test-matrix.json) (see [`docs/TEST-MATRIX.md`](TEST-MATRIX.md)) and run the **Builder → Doctor contract** inside [`.github/workflows/ci.yml`](../.github/workflows/ci.yml). **Gate** is the only verdicto.

Local runners:

```bash
# Matrix resolve
node scripts/resolve-test-matrix.js --profile pr --print-table

# Contract (Gate jobs)
node scripts/run-builder-doctor-contract.js --family java-maven --case java17-basic
```

## Executed in CI Gate — profile `pr` (default)

Representative subset only. Full version lists run on `schedule` / `workflow_dispatch` profile `full` (or `release`).

| Fixture                      | Runtime            | Scenario    | Job              |
| ---------------------------- | ------------------ | ----------- | ---------------- |
| java/maven/java17-basic      | Java 17            | Basic       | java-maven       |
| java/maven/java21-basic      | Java 21            | Basic       | java-maven       |
| java/maven/springboot-java17 | Java 17            | Spring Boot | java-maven       |
| java/gradle/java17-basic     | Java 17            | Basic       | java-gradle      |
| java/gradle/java21-basic     | Java 21            | Basic       | java-gradle      |
| javascript/vanilla-node      | Node 20 / npm      | Node        | javascript       |
| javascript/nestjs-yarn       | Node 20 / yarn     | NestJS      | javascript       |
| javascript/vue-pnpm          | Node 20 / pnpm     | Vue         | javascript       |
| typescript/node-typescript   | Node 20            | Node TS     | typescript       |
| typescript/react-typescript  | Node 20            | React TSX   | typescript       |
| dotnet/net8-console          | .NET 8             | Console     | dotnet-modern    |
| dotnet/net8-webapi           | .NET 8             | Web API     | dotnet-modern    |
| dotnet/net10-console         | .NET 10            | Console\*   | dotnet-modern    |
| dotnet/net48                 | .NET Framework 4.8 | Framework   | dotnet-framework |

\*Experimental (`continue-on-error`). Stable cells never use continue-on-error.

See `docs/TEST-MATRIX.md` for Full / Release coverage.

## Fixtures present but only on Full/Release (or local)

| Fixture / group | Notes |
| --- | --- |
| java maven/gradle 8,11,25,26; springboot-21; war; multimodule; kotlin-dsl | Full/Release (`test-matrix.json`) |
| javascript express/react/next/angular; typescript express/next | Full/Release |
| dotnet 6/7/9; classlib; aspnet; blazor; vb; multi-project | Full/Release (9/10/Blazor experimental) |
| java/gradle springboot & multimodule; nestjs-typescript; azure-functions | Local/optional (not in matrix SoT yet) |
| private-deps/\* | Stubs for mocked private registries (no credentials) |

## Private dependency stubs

See `tests/fixtures/integration/private-deps/` — Maven `settings.xml`, NuGet `nuget.config`, npm `.npmrc` use **env var names only**.
