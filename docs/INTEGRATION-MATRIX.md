# Integration fixtures matrix

Last updated: 2026-08-07

Integration fixtures live under `tests/fixtures/integration/`.
CI jobs run inside the single workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) and feed the **Gate** (there is no separate `integration.yml` — see `.cursor/rules/ci-gate.mdc`).

Local runner:

```bash
node scripts/run-integration-fixture.js \
  --source tests/fixtures/integration/java/maven/java17-basic \
  --expect-language java \
  --expect-build-system maven \
  --expect-runtime 17 \
  --builder java-maven \
  --expect-zip-entry '.class'
```

## Executed in CI (Gate)

Only rows below are claimed as verified when the Gate is green.

| Fixture                              | Runtime            | Build                | Artifact | Job                        |
| ------------------------------------ | ------------------ | -------------------- | -------- | -------------------------- |
| java/maven/java8-basic               | Java 8             | PASS\*               | PASS\*   | java-maven                 |
| java/maven/java11-basic              | Java 11            | PASS\*               | PASS\*   | java-maven                 |
| java/maven/java17-basic              | Java 17            | PASS\*               | PASS\*   | java-maven                 |
| java/maven/java21-basic              | Java 21            | PASS\*               | PASS\*   | java-maven                 |
| java/maven/war-java17                | Java 17            | PASS\*               | PASS\*   | java-maven                 |
| java/maven/springboot-java17         | Java 17            | PASS\*               | PASS\*   | java-maven                 |
| java/maven/multimodule-java17 (core) | Java 17            | PASS\*               | PASS\*   | java-maven                 |
| java/gradle/java17-basic             | Java 17            | PASS\*               | PASS\*   | java-gradle                |
| java/gradle/java21-basic             | Java 21            | PASS\*               | PASS\*   | java-gradle                |
| java/gradle/kotlin-dsl-java17        | Java 17            | PASS\*               | PASS\*   | java-gradle                |
| javascript/vanilla-node              | Node 20            | N/A (SOURCE_PACKAGE) | PASS\*   | javascript                 |
| javascript/express                   | Node 20            | N/A                  | PASS\*   | javascript                 |
| javascript/react                     | Node 20            | N/A                  | PASS\*   | javascript                 |
| javascript/nestjs-yarn               | Node 20 / yarn     | N/A                  | PASS\*   | javascript                 |
| javascript/vue-pnpm                  | Node 20 / pnpm     | N/A                  | PASS\*   | javascript                 |
| typescript/node-typescript           | Node 20            | N/A                  | PASS\*   | typescript                 |
| typescript/express-typescript        | Node 20            | N/A                  | PASS\*   | typescript                 |
| typescript/react-typescript          | Node 20            | N/A                  | PASS\*   | typescript                 |
| dotnet/net6-console                  | .NET 6             | PASS\*               | PASS\*   | dotnet-modern              |
| dotnet/net8-console                  | .NET 8             | PASS\*               | PASS\*   | dotnet-modern              |
| dotnet/net8-webapi                   | .NET 8             | PASS\*               | PASS\*   | dotnet-modern              |
| dotnet/vbnet                         | .NET 8             | PASS\*               | PASS\*   | dotnet-modern              |
| dotnet/multi-project-solution        | .NET 8             | PASS\*               | PASS\*   | dotnet-modern              |
| dotnet/net48                         | .NET Framework 4.8 | PASS\*               | PASS\*   | dotnet-framework (windows) |

\*PASS = asserted by CI when Gate is green for that PR/run. Do not treat this table as green until Gate succeeds.

## Fixtures present but not executed in CI

Created for Discovery/local use; **not** claimed as CI-verified:

| Fixture                                                                            | Notes                                                               |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| java/maven/java25-basic, java26-basic                                              | Runtime extractable by Discovery; JDK may be unavailable on runners |
| java/gradle/java8-basic, java11-basic, java25-basic, java26-basic                  | Same                                                                |
| java/maven/springboot-java21                                                       | Framework fixture; CI runs springboot-java17 only                   |
| java/gradle/springboot-java17, multimodule-java17                                  | Local/optional                                                      |
| javascript/nextjs, vue, angular, nestjs                                            | Package manifests + source; CI covers package-manager reps instead  |
| typescript/nextjs-typescript, nestjs-typescript                                    | Fixtures only                                                       |
| dotnet/net7-console, net9-console, net10-console                                   | Fixtures only                                                       |
| dotnet/net8-classlibrary, net8-aspnet-core, net8-blazor-wasm, net8-azure-functions | Heavier; not in Gate matrix yet                                     |
| private-deps/\*                                                                    | Stubs for mocked private registries (no credentials)                |

## Private dependency stubs

See `tests/fixtures/integration/private-deps/` — Maven `settings.xml`, NuGet `nuget.config`, npm `.npmrc` use **env var names only**.
