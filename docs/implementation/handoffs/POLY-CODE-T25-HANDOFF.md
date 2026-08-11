# Polyglot coding upgrade handoff

- Task: repository-aware polyglot coding capability upgrade implementation.
- Branch: `codex/polyglot-coding-upgrade`.
- Implementation commits: `cff12d6`, `9af1d6e`, `383e195`, and `d5ec608`.
- Evidence: `docs/implementation/evidence/coding-upgrade/`.
- Runtime boundary: coding remains `LOCAL_ONLY_EXPERIMENTAL`; the production feature manifest and `P07-T05` production-completion task were not promoted.

## Delivered

Capability registry, repository intelligence, structured retrieval, adaptive context allocation, typed coding artifacts, preconditioned editing, native command/diagnostic handling, bounded repair, review/test strategy, provider-routed structured drafting, explicit write/repair authorization, client workflow status, polyglot fixtures, and baseline/upgraded benchmark reporting.

## Verification

`npm run type-check`, server/client lint, `npm run build`, phase-2 checks, and full Jest passed: 149 suites passed, 463 tests passed, and 2 tests were skipped. The focused coding, credential-isolation, structural-retrieval, provider-failure, parser, and bounded-repair tests passed.

## Open release boundaries

- The checked-in live evidence bundle records a successful explicit `gemini-3.6-flash` run at `d5ec608`: 13 ready and 14 unsupported toolchains, 11 model-adapter cases, and honest failed/unsupported checks where the model output or toolchain did not satisfy the fixture. A separate `deepseek-chat` run also reached the ready cases; the earlier `gemini-2.0-flash` attempt was rejected because that model was retired.
- Fourteen fixture toolchains are unavailable on this Windows environment and are reported as unsupported.
- `npm run release:check` still fails the existing server uncovered-count threshold (statements 14,949 > 14,243; branches 8,957 > 8,217; lines 13,561 > 13,039; functions 3,060 > 2,905); the threshold was not reduced or bypassed.
- Maintained AST adapters for every listed language and hosted-production certification remain out of scope for this handoff.

## Rollback

Disable/remove the new coding adapter/controller routes and retain the legacy `CodingAgent`, `PatchGenerator`, `VerificationRunner`, and `CodeReviewer` compatibility paths. No workspace migration or destructive data operation is required.
