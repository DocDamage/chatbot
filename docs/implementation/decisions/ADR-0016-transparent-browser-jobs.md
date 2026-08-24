# ADR-0016: Transparent Browser Jobs

- Status: Accepted
- Date: 2026-08-24
- Scope: Capability Fusion / CF-06
- Maturity: `LOCAL_ONLY_EXPERIMENTAL`

## Decision

CF-06 delivers bounded, transparent browser automation and QA execution to support test runs, DOM inspection, screenshot capture, and user-authorized workflows without evasion or stealth mechanisms.

1. **`AuthorizedBrowserJob` Contract & Origin Allowlisting**:
   Every browser job is governed by an immutable contract containing the job purpose, requester, budget caps, allowed schemes, and explicit target-origin allowlists. Target URLs outside allowlisted origins fail closed. Unauthorized protocols (`javascript:`, `file:`, `data:`) are rejected.
2. **Explicit Exclusion of Stealth & Evasion Mechanisms**:
   The system explicitly excludes and strictly rejects CAPTCHA bypass, fingerprint spoofing, stealth flags, proxy rotation for evasion, and access-control bypass. If any stealth configuration or action metadata is passed, the job fails closed immediately.
3. **State-Changing Action Cryptographic Approval Gate**:
   Form submissions, file uploads, account mutations, and actions explicitly marked as state-changing require a verified cryptographic SHA-256 approval digest (`computeActionApprovalDigest`) signed by an authorized approver before execution. Unapproved state-changing actions pause the job in `awaiting_approval` and reject execution.
4. **Isolated Ephemeral Sandboxing**:
   `BrowserJobSandbox` provisions separate ephemeral user data profile directories and isolated download directories per job. Path traversal (`..`), null bytes, and sandbox escapes in downloaded files are strictly blocked. Download quotas and total directory sizes are enforced. All ephemeral sandboxes and browser process trees are automatically cleaned up on completion or cancellation.
5. **Redacted QA Evidence Collection**:
   `BrowserEvidenceCollector` captures DOM snapshots, screenshots, console logs, and network trace events. Sensitive HTTP headers (`Authorization`, `Cookie`, `Set-Cookie`, `X-API-Key`, `Proxy-Authorization`), query parameters (`token`, `password`, `apiKey`, `secret`), and password form inputs are automatically sanitized to `[REDACTED]`.
6. **Local-Only Disabled-by-Default Pydoll Adapter**:
   The optional Pydoll CDP adapter remains strictly `LOCAL_ONLY`, disabled by default, and restricted to local loopback endpoints (`127.0.0.1`, `localhost`). It is architecturally prohibited in hosted environments and explicitly stripped of stealth features.

## Boundaries and Security Invariants

- **Clean License Boundary**: MIT-licensed concepts and project-owned clean contracts are used.
- **Fail-Closed Principle**: Any unallowlisted origin, unapproved state-changing action, or expired job fails closed.
- **Zero Stealth Authority**: Anti-detection, fingerprint spoofing, and CAPTCHA evasion are completely excluded from the product.
- **Credential Protection**: No authentication tokens, cookies, or secrets leak into QA artifacts or logs.
