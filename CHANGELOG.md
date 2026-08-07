# Changelog

Todas as mudancas notaveis deste projeto serao documentadas neste arquivo.

O formato e baseado no [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e este projeto adota [Versionamento Semantico](https://semver.org/lang/pt-BR/).

## [0.1.2] - 2026-08-07

### Changed

- Gate do workflow CI e a unica fonte de verdade; jobs novos devem entrar no Gate.

## [0.1.1] - 2026-08-07

### Changed

- Unificou Quality, Integration e Release em um unico workflow `CI` com jobs paralelos e gate final.

## [0.1.0] - 2026-08-07

### Added

- Action composite `Afrika-Veracode-Build` com orquestrador raiz.
- Discovery automatico para Java (Maven/Gradle), JavaScript/TypeScript e .NET.
- Builders para Maven, Gradle, source package JS/TS e .NET (moderno, Framework, ASP.NET, Blazor WASM).
- Doctor (preflight) baseado em requisitos publicos documentados da Veracode.
- Build Config remoto atualizavel com fingerprint SHA-256 e GitHub App/PAT.
- Inputs, outputs, codigos de erro padronizados e documentacao completa do MVP.

[0.1.2]: https://github.com/JuanCunhaa/Afrika-Veracode-Build/releases/tag/v0.1.2
[0.1.1]: https://github.com/JuanCunhaa/Afrika-Veracode-Build/releases/tag/v0.1.1
[0.1.0]: https://github.com/JuanCunhaa/Afrika-Veracode-Build/releases/tag/v0.1.0
