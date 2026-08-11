# Polyglot coding upgrade handoff

- Task: repository-aware polyglot coding capability upgrade implementation.
- Branch: `codex/polyglot-coding-upgrade`.
- Implementation commit: `334215c217852a1e412ef81fe195f22e1f1bc3fb`.
- Evidence: `docs/implementation/evidence/coding-upgrade/`.
- Runtime boundary: coding remains `LOCAL_ONLY_EXPERIMENTAL`; the production feature manifest and `P07-T05` production-completion task were not promoted.

## Delivered

Capability registry, repository intelligence, structured retrieval, adaptive context allocation, typed coding artifacts, preconditioned editing, native command/diagnostic handling, bounded repair, review/test strategy, provider-routed structured drafting, explicit write/repair authorization, client workflow status, polyglot fixtures, and baseline/upgraded benchmark reporting.

## Verification

`npm run type-check`, server/client lint, `npm run build`, full Jest (`147` suites and `449` tests passed; `2` skipped), security (`10` passed), e2e services (`5` passed), and `npm run check:phase2` passed. The focused isolated model executor and bounded repair tests passed.

## Open release boundaries

- Benchmark artifacts were generated with no provider call. Use the explicit `npm run eval:coding -- --upgraded --live-model` flow only with an authorized provider configuration to collect live model request/response and applied-patch evidence.
- Fourteen fixture toolchains are unavailable on this Windows environment and are reported as unsupported.
- `npm run release:check` still fails the existing server uncovered-count threshold; the threshold was not reduced or bypassed.
- Maintained AST adapters for every listed language and hosted-production certification remain out of scope for this handoff.

## Rollback

Disable/remove the new coding adapter/controller routes and retain the legacy `CodingAgent`, `PatchGenerator`, `VerificationRunner`, and `CodeReviewer` compatibility paths. No workspace migration or destructive data operation is required.
