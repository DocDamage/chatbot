# Coding capability upgrade runtime guide

The coding subsystem is repository-aware and remains local-only experimental until the production tracker separately certifies its vertical slice.

## Read-only workflow

- `POST /api/code/ask` inspects the repository and returns the existing compatibility response shape.
- `GET /api/code/repository` returns detected files, nested project roots, instructions, manifests, languages, build systems, and relationship evidence.
- `POST /api/code/retrieve` accepts `query`, optional `files`, `symbols`, `diagnostics`, and `maxItems`; every item includes authority, confidence, and retrieval reason.
- `POST /api/code/plan` remains available only in `plan` mode.

## Patch and verification workflow

- `POST /api/code/patch/structured` accepts preconditioned create/modify/delete operations and returns a reviewable diff. It is available only in `implement` mode.
- `POST /api/code/patch/apply` accepts the same structured operations but requires `mode=implement`, `approved=true`, explicit per-operation authorization, clean preconditions, and the workspace write gate before mutation.
- `POST /api/code/verify/native` selects commands from detected project state. It is available only in `implement` or `debug` mode.
- `POST /api/code/repair` runs a bounded, diagnostic-triggered repair proposal in `debug` mode only; it requires explicit approval and per-operation authorization and returns attempt/delta/remaining-risk records.
- The code workflow panel exposes repository inspection, evidence retrieval, structured patch drafts, affected-file/conflict status, explicit approved apply, and native verification for the active work mode.
- When the orchestrator has a configured coding-capable provider, it routes the request through that adapter and asks for the constrained JSON operation format. The result is still a non-applied draft; write authorization and precondition checks remain separate.
- Repository commands use executable/argv plans with `shell: false`, bounded output, timeouts, and explicit unsupported-tool reporting.
- Repair is bounded to three iterations by default and records the hypothesis, edit scope, command results, diagnostic delta, and remaining risk. It requires explicit authorization when called through the shared coding authorization service.

Plan and chat modes do not write files or execute repository commands. Patch application remains separate from patch creation and requires explicit approval and clean preconditions.

## Evaluation

Run the fixed fixture/toolchain preflight with:

```text
npm run eval:coding
npm run eval:coding -- --upgraded
```

Raw reports are stored under `docs/implementation/evidence/coding-upgrade/{baseline,upgraded}`. Unsupported toolchains are reported separately and never counted as passes. The current preflight does not claim task correctness until an executor produces patches and runs visible/hidden checks; see `comparison.md`.

For an explicitly authorized live-provider run, set `OPENAI_API_KEY` and run `npm run eval:coding -- --upgraded --live-model` with an optional `CODING_EVAL_MODEL`. The live flag is opt-in and never sends repository content to a provider during ordinary preflight runs. Model patches are applied only inside a temporary isolated worktree, then visible and configured hidden checks are recorded.
