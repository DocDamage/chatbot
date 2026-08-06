# P03-T05 Verification Summary

## Task

- Task: `P03-T05 — Add real browser E2E testing`
- Status: `VERIFIED`
- Branch: `agent/p03-t05-real-browser-e2e`
- Implementation head: `cef6288dfe784e55fc1ad69b5ff2c786b7b83072`
- Pull-request merge ref tested by GitHub Actions: `b7765c365139aa193a3f77c7e56552c9169b9e56`
- Draft pull request: `#162`
- Verification CI: `31081497523`
- Required CI gate: success

## Implemented verification program

- Reclassified the previous Jest mock/service scenarios as `test:e2e:services` instead of presenting them as browser proof.
- Added Playwright against the compiled React client served by the compiled production Express server.
- Added deterministic generated text, PNG, and WAV fixtures plus an isolated SQLite runtime profile.
- Added a no-shell local-tool fixture that exits unless the exact `P03-T05-safe-run` marker is supplied.
- Added desktop Chromium workflows for authentication/authorization/session expiry, settings, mode switching, chat, SSE streaming, conversation persistence and reload, file loading, audio preview/loading, Knowledge Online approval, local-tool plan/approve/run, Sprite Lab manifest generation, and provider/readiness degradation.
- Added a Pixel 5 mobile Chromium chat smoke workflow.
- Retained Playwright JSON and HTML reports, traces, screenshots, videos, and safe local-run output as CI artifacts.
- Made the built-server browser job an independent required CI job and extended the CI graph verifier so the gate cannot silently regress to the old smoke harness.

## Product defects exposed and repaired

1. Settings reinitialization cleared its own successful save confirmation. The confirmation now survives the reload and is browser-verified.
2. Persisted conversation summaries used lexical `MIN(content)` and `MAX(content)` values rather than chronological first/last messages. Correlated chronological queries and a focused regression test now preserve the actual first and last messages, allowing history reload to work correctly.

## Verification result

- Service E2E: 3 suites, 5 tests passed.
- Built-server Playwright: 7 of 7 workflows passed in 13.7 seconds.
- Browser engines/profiles: desktop Chromium and Pixel 5 mobile Chromium.
- Compiled server and client production builds passed before browser execution.
- Browser artifact: `browser-e2e-31081497523`, artifact ID `8959667465`, digest `sha256:dbe6da3f6ed1f5ca5eebdafc6c1f91d629dc22c534e222d1c48e5c8746e0d0fa`.
- All other independent CI jobs passed: repository integrity, Node 22/24 lockfile compatibility, server/client/test type checks, server/client lint, server/client tests, accessibility, security, coverage, SQLite migrations, package smoke, Docker smoke, documentation/policy validation, and release-evidence validation.
- Aggregate Required CI gate passed.

## Controlled boundaries

- The baseline chat canary used the real configured template adapter; no provider success was fabricated.
- Knowledge Online retrieval/ingestion and provider-outage behavior were mocked only at explicit HTTP boundaries.
- The repository has no end-user login/logout screen yet. The suite therefore injects signed JWTs at the browser context and verifies unauthenticated, insufficient-role, expired-session, and privileged behavior against the real middleware/API boundary.
- Live remote-provider canaries remain P06-T03 and are not claimed here.
- Existing dependency vulnerabilities shown during install remain the explicit scope of P03-T06 and are not represented as resolved by this task.

## Feature-manifest impact

No feature classification changed. This task verifies existing production-candidate workflows and CI behavior; it does not promote any feature to production-supported status.
