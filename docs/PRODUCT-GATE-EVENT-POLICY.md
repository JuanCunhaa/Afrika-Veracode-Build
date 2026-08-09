# Product Gate & Release Certification — Event Policy

Source of truth: [`schemas/event-policy.json`](../schemas/event-policy.json)

| Event             | Local        | Lab          | Veracode Pipeline Scan | Gate                       |
| ----------------- | ------------ | ------------ | ---------------------- | -------------------------- |
| Push non-main     | required     | `pr`         | none                   | Product Quality Gate       |
| PR → main         | required     | `pr`         | none                   | Product Quality Gate       |
| merge_group       | required     | `pr`         | none                   | Product Quality Gate       |
| Push main         | required     | `full`       | `representative`       | Product Main Gate          |
| Release Candidate | required     | `full`       | `full`                 | Release Certification Gate |
| workflow_dispatch | configurable | configurable | configurable           | configurable               |

## Counts (declared / Lab / Veracode)

Measured from current sources (do not hardcode elsewhere):

| Matrix                                               |  Count |
| ---------------------------------------------------- | -----: |
| Declared support rows                                |     23 |
| Release-eligible public rows needing Veracode        |     14 |
| Lab PR compatibility cases                           |     14 |
| Lab Full compatibility cases                         |     40 |
| Veracode representative (sanity / main)              |      7 |
| Veracode release **full** (= Lab Compatibility Full) | **40** |

Notes:

- Legacy curated `full≈10` / derived certification-only `full≈15` are obsolete for Pipeline `profile=full`.
- `full` = all Lab Compatibility Full cases (40). Packaging variants in `veracodeCertification.cases` still gate public-row Veracode ✅.
- Representative stays curated (~7) for main sanity.

## Trust boundary

- `VERACODE_API_ID` / `VERACODE_API_KEY` only on trusted Lab environment `veracode-pipeline-e2e`
- Never on PR-owned workflows or forks
- README / certification-status updater consumes sanitized evidence only

## Docs-only shortcut

Allowed only when changed files ⊆ `README.md`, `schemas/certification-status.json`, `CHANGELOG.md`, `docs/**`.
Any code change forces full gates.
