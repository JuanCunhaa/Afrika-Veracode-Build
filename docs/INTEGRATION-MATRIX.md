# Integration Matrix

Last updated: 2026-08-08

Real application fixtures and Builder → Doctor contract execution live in the private Lab:

- Applications: `Afrika-Veracode-Build-Lab/applications/`
- Contracts: `Afrika-Veracode-Build-Lab/contracts/builder-doctor/`
- Matrix: `Afrika-Veracode-Build-Lab/matrix/test-matrix.json`

They are executed by Lab `lab-gate.yml` against Action SHA checked out to `.action-under-test` with `config_mode: disabled`.

Action Local Gate does **not** run integration fixtures. See [`docs/TEST-LAB.md`](TEST-LAB.md).

## Local Lab commands (maintainer)

```bash
export ACTION_ROOT=/path/to/Afrika-Veracode-Build   # or .action-under-test
node scripts/resolve-test-matrix.js --profile pr --print-table
node scripts/run-builder-doctor-contract.js --family java-maven --case java17-basic
```

## Private deps samples

See Lab `applications/private-deps/` — Maven `settings.xml`, NuGet `nuget.config`, npm `.npmrc` use **env var names only**. Compatibility PR Lab runs never receive real registry credentials.
