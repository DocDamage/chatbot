# Capability Fusion — CF-06 Rolling Record

- Status: `LOCAL_ONLY_EXPERIMENTAL`
- Scope: Workstream CF-06 — Transparent browser jobs

> Audit correction (2026-08-24): Policy contracts and a real Puppeteer driver exist, but full job authoring/resume UI, retained real-browser evidence, process-tree cancellation proof, and a real-browser canary remain open. The implementation does not currently use Playwright as the default. See [CF-04_TO_CF-10_IMPLEMENTATION_AUDIT.md](./CF-04_TO_CF-10_IMPLEMENTATION_AUDIT.md).

## Workstreams & Deliverables

- [x] Defined `AuthorizedBrowserJob` contract with origin allowlist, purpose, expiry, requester, action budget limits, and cryptographic job digest (`AuthorizedBrowserJob.ts`).
- [x] Implemented isolated ephemeral browser profile and download directory sandbox manager with path containment, download budget caps, and automatic cleanup (`BrowserJobSandbox.ts`).
- [x] Implemented QA evidence collector capturing screenshots, DOM snapshots, network traces, and console logs with automated credential, cookie, token, and password redaction (`BrowserEvidenceCollector.ts`).
- [x] Implemented cryptographic SHA-256 approval digest gate for state-changing actions (form submission, file upload, account mutations) requiring explicit approval before execution (`AuthorizedBrowserJob.ts`, `BrowserJobRunner.ts`).
- [x] Implemented `BrowserJobRunner` orchestrator supporting cancellation, step limits, timeout budgets, and driver integration.
- [x] Implemented local-only, disabled-by-default `PydollAdapter` strictly prohibited in hosted environments and locked to loopback interfaces (`PydollAdapter.ts`).
- [x] Enforced explicit prohibition and fail-closed rejection of stealth, CAPTCHA bypass, fingerprint spoofing, and proxy evasion features.
- [x] Architectural Decision Record ADR-0016 (`docs/implementation/decisions/ADR-0016-transparent-browser-jobs.md`).
- [x] Comprehensive test suite with 26 passing tests (`AuthorizedBrowserJob.test.ts`).
