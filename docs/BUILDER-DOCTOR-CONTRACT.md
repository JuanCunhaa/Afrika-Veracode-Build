# Builder → Doctor Contract

Last updated: 2026-08-07

Prove that every artifact produced by a supported Builder is accepted by the matching Doctor.

## Pipeline

```
Real Fixture → Discovery → BuildPlan → Builder → Artifact → Doctor
```

Allowed Doctor statuses: `READY` | `READY_WITH_WARNINGS` (documented WARNs only).

## Global rule

If `Builder` succeeds and the strategy is supported, Doctor **MUST NOT** return `INVALID`.

Violation fails immediately with:

```text
BUILDER_DOCTOR_CONTRACT_BROKEN
language / runtime / builder / artifact / failed doctor rule
```

`READY_WITH_WARNINGS` must not hide Builder regressions (example: Debug build without PDB when `requirePdb` is set).

## Layout

```text
tests/contract/builder-doctor/
  lib/contract.js
  java-maven/cases.json
  java-gradle/cases.json
  javascript/cases.json
  typescript/cases.json
  dotnet/cases.json
```

Fixtures remain under `tests/fixtures/integration/`. Golden copies may be written to `tests/artifacts/{java,javascript,dotnet}/` at runtime (zips gitignored).

## Local

```bash
# one family
node scripts/run-builder-doctor-contract.js --family javascript

# one case (CI shape)
node scripts/run-builder-doctor-contract.js --family java-maven --case java17-basic

# helpers (no toolchain)
npm test   # includes tests/unit/contract/
```

## CI / Gate

Jobs in `.github/workflows/ci.yml` (`java-maven`, `java-gradle`, `javascript`, `typescript`, `dotnet-modern`, `dotnet-framework`) run this contract runner and feed the **Gate**. Release must not proceed without Gate `success`.

## Summary shape

```text
Builder → Doctor Contract
Java Maven: PASS X/X
Java Gradle: PASS X/X
JavaScript: PASS X/X
TypeScript: PASS X/X
.NET: PASS X/X
Contract violations: 0
```

## Regression policy

When a Builder/Doctor bug is found: add a fixture + case that reproduces, land a failing test, fix, keep the case permanently.
