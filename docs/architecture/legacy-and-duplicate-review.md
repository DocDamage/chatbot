# Legacy, Duplicate, and Dormant Implementation Review

## Document control

- Owner: Architecture
- Review date: 2026-11-05
- Task: P02-T03

## Decisions

| Surface | Finding | Phase 2 disposition | Future owner/task |
|---|---|---|---|
| `POST /api/chat` legacy chat | Active compatibility endpoint, not dormant | Keep as `PRODUCTION_PREVIEW`; do not count as the final chat contract | Core chat / P07-T01 |
| `/api/v1/*` and `/api/v2/*` chat routers | Parallel versioned compatibility surfaces | Keep reachable and explicitly reviewed; later vertical-slice work must select and document the supported contract | Core chat / P07-T01 |
| Provider adapters | Multiple adapters are intentional capability implementations | Keep profile-dependent and preview-only until provider contract tests and canaries pass | Provider platform / P06-T01–P06-T03 |
| Local file, audio, code, command, Sprite Lab, and FL Studio modules | Local-machine capabilities were previously registered in all profiles | Retain source, classify `LOCAL_ONLY_EXPERIMENTAL`, and exclude from hosted route registration | P07-T05–P07-T07, P07-T12–P07-T13, P07-T17 |
| Alternate orchestration, memory, learning, automation, and advisor modules | Static inventory may discover modules with no startup/UI/background path | Keep unregistered as `DISABLED_OR_REMOVED`; generated reachability and boundary checks fail if an isolated module becomes reachable without reclassification | Relevant Phase 6/7 owner |
| Thin exports or placeholder wrappers | A wrapper is not a completed feature | Keep only when reachable and useful as an API boundary; otherwise it remains dormant and cannot be counted as completed | Relevant vertical-slice task |

## Enforcement

`config/production-boundary.json` and `scripts/release/check-production-boundary.mjs` make the decisions machine-checkable. The generated reachability map lists every production source file with no static path from a server or client entrypoint. A later task that activates one must also update the feature manifest, boundary metadata, tests, and evidence.
