# P00-T04 Verification Commands

## Repository inspection

The connected GitHub application was used because no authenticated local checkout was mounted.

| Operation | Arguments | Result |
|---|---|---|
| `GitHub.get_repo` | `DocDamage/chatbot` | Repository accessible with write permission |
| `GitHub.fetch_file` | `docs/implementation/handoffs/CURRENT_HANDOFF.md` at `main` | Confirmed `P00-T04` was the next authorized task |
| `GitHub.fetch` | `git/ref/heads/main` | Baseline `4b10a434f5b60216608da74303d4193bc289e372` |
| `GitHub.compare_commits` | base `4b10a434f5b60216608da74303d4193bc289e372`, head `923d3a14de0c1b6b9b5aab31cd14663869b3dda7` | `ahead`, 1 commit, 12 documentation files |

## Deterministic documentation validation

Run from the repository root:

```bash
python3 docs/implementation/evidence/PHASE-00/P00-T04/2026-08-05_923d3a14/artifacts/validate_decisions.py \
  --repo-root . \
  --json-output docs/implementation/evidence/PHASE-00/P00-T04/2026-08-05_923d3a14/artifacts/validation-report.json
```

Observed exit code: `0`.

## Blob-integrity check

The Git object ID for every locally generated decision file was calculated as SHA-1 over `blob <byte-length>\0<content>`. All twelve calculated IDs matched the IDs returned by `GitHub.create_blob` before the implementation tree was committed.

## Commands intentionally not claimed

Application type-check, lint, unit, browser, accessibility, package, database, and deployment commands were not run as completion evidence because `P00-T04` changes governance documentation only. Existing product-release blockers remain open.
