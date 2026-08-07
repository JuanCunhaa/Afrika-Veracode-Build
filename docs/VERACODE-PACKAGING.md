# Veracode Packaging Rules Used by This Action

Last verified against Veracode documentation: 2026-08-07

This Action implements **only** packaging rules that are publicly documented by Veracode.
The Doctor validates what is technically verifiable from those docs. It does **not** claim to reproduce Veracode's proprietary prescan.

## Official references

| Topic                               | URL                                              |
| ----------------------------------- | ------------------------------------------------ |
| Quick reference                     | https://docs.veracode.com/r/c_comp_quickref      |
| Java packaging                      | https://docs.veracode.com/r/compilation_java     |
| .NET packaging                      | https://docs.veracode.com/r/compilation_net      |
| ASP.NET packaging                   | https://docs.veracode.com/r/compilation_ASPnet   |
| ASP.NET MSBuild precompile          | https://docs.veracode.com/r/c_precomp_MS         |
| JavaScript and TypeScript packaging | https://docs.veracode.com/r/compilation_jscript  |
| About autopackaging                 | https://docs.veracode.com/r/About_auto_packaging |

## Java (compiled)

- Upload JAR, WAR, or EAR with debug symbols recommended (source/lines/vars).
- Veracode can analyze Java with or without debug; missing debug => warning, not hard failure in `standard` mode.
- Nested JARs unsupported except Spring Boot.
- Maven Shade: analysis may work for first-party code; SCA limited — warn and recommend disabling Shade when possible.
- Quarkus: prefer uber-jar `*-runner.jar`.
- WAR should include `WEB-INF/`, `WEB-INF/classes/`, `WEB-INF/lib/`, `WEB-INF/web.xml` when applicable.
- Java source scanning is supported by Veracode, but this Action does **not** silently fall back from compiled to source. Use `java_package_mode=source` explicitly.

## JavaScript / TypeScript

- Upload ZIP of readable source; do not minify, obfuscate, bundle, or production-build for Veracode artifact.
- Prefer original `.ts` / `.tsx`; do not precompile TypeScript only for scan.
- Exclude `node_modules` when lockfiles are present (recommended).
- Include `package.json` and lockfile (`package-lock.json` / `npm-shrinkwrap.json` lockfileVersion <= 3, or `yarn.lock`).
- Source maps must include `sources` and `sourcesContent` when used.
- Filenames suggesting minification/concatenation (e.g. `*.min.js`, `all.js`) are ignored by Veracode — warn/fail accordingly.

## .NET

- Analyze compiled bytecode (EXE/DLL) with PDB recommended for filenames/line numbers.
- Modern (.NET Core / 5+): `dotnet publish -c Debug -o <out> -p:UseAppHost=false` (framework-dependent).
- Include `deps.json` or `project.assets.json` when available for SCA accuracy.
- Do not submit Self-Contained Deployment.
- Exclude test project assemblies.
- ASP.NET: precompiled forms required; remove `roslyn` directory when present (recommended).
- Blazor WebAssembly: **build** (not publish), disable compression (`BlazorEnableCompression=false`).
- .NET Framework / classic ASP.NET typically require Windows runners / MSBuild.

## Classification used internally

| Technology              | Strategy                |
| ----------------------- | ----------------------- |
| Java Maven/Gradle       | BUILD_REQUIRED / HYBRID |
| JavaScript / TypeScript | SOURCE_PACKAGE          |
| .NET                    | BUILD_REQUIRED          |

When documentation and third-party blogs conflict, **official Veracode docs win**.
