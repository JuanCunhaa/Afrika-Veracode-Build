# Contract golden artifacts

Generated at test time under this tree (`*.zip`, `*-entries.json`).

Do **not** commit large binaries. CI/local contract runs may populate:

- `java/` — Maven/Gradle analysis packs
- `javascript/` — SOURCE_PACKAGE zips (JS/TS)
- `dotnet/` — publish packs

Only READMEs and `.gitkeep` belong in git.
