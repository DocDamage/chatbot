# CF-00 — Capability Fusion Governance and Approved Repository Boundary

## Status

`VERIFIED` as a capability-fusion foundation subtask.

This record does **not** mark production-plan tasks `P04-T05` or `P07-T05` complete. Both broader tasks retain their existing release status and remaining acceptance work.

## Repository state

- Repository: `DocDamage/chatbot`
- Branch: `agent/p07-t05-capability-fusion-foundation`
- Base commit: `a4f540e5f697b50c69c4e56ce7ed350d6e3b564d`
- Verified implementation commit: `58dd3ec1076928a973496c63daa72cba52e77db3`
- Pull request: `#163`
- Verification workflow: GitHub Actions CI run `32668575991`
- Required CI gate: `success`
- Date: `2026-08-23`

## Scope completed

- Audited the ten requested source repositories for capability fit, trust boundaries, and repository-license constraints.
- Added ADR-0011 to prohibit bulk merging and require native, external-service, or clean-room integration paths.
- Added a phased capability-fusion roadmap covering repository intelligence, lexical retrieval, risk/SARIF/SBOM data, local-model adapters, agent teams, safe browser jobs, media localization, Lattice integration, UI, and release evaluation.
- Added `ApprovedRepositoryGateway` as the single agent-facing repository read/search boundary.
- Routed repository listing, bounded text reading, literal search, reference search, import graph generation, lightweight symbol indexing, structural symbol indexing, and relationship source reads through the shared gateway.
- Preserved the existing independent command, patch, mode, and approval controls; no new write, shell, Git mutation, browser-control, or model-process authority was introduced.
- Regenerated and committed repository inventory and reachability artifacts against the verified implementation.

## Security behavior verified

The gateway rejects or filters absolute paths, parent traversal, null-byte paths, sensitive workspace paths, symlink/junction traversal, binary reads through the text interface, oversized reads/scans/results, and ignored dependency/build/cache directories.

Focused tests also verify that agent-facing repository tools fail closed through the same boundary.

## Verification result

Clean CI run `32668575991` passed every required job: repository integrity; Node 22/24 dependency integrity; server/client/test type checks; server/client lint; server/client tests; browser E2E; accessibility; security; server/client coverage; SQLite migration tests; container and package smoke; generated inventory, reachability, file-size, environment, and docs validation; release-evidence validation; and the final required gate.

## Known limitations

- Coding and local-filesystem capabilities remain `LOCAL_ONLY_EXPERIMENTAL`.
- The CI runner verified Linux symlink containment. A real Windows junction/reparse-point run remains required before Windows support promotion.
- The broader File Explorer and legacy filesystem surfaces still require their own migration and verification.
- No requested external repository beyond the foundation policy and permissive adaptation boundary has been integrated yet.
- GitGalaxy and dev-house source remain noncommercial; Warpdrv remains AGPL; SearchEngineSuite source remains unavailable for reuse under a located repository license. Restricted source was not copied.
- Browser evasion, identity-masking, and challenge-bypass features from Pydoll are explicitly excluded.

## Next authorized task

`CF-01 — RepoDNA-style deterministic repository architecture graph`
