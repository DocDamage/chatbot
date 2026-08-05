# ADR-0003 — GitHub Pages Purpose

- **Status:** Accepted
- **Date:** 2026-08-05
- **Decision owners:** AI Chatbot Hub release governance
- **Authorized task:** `P00-T04`
- **Decision baseline:** `main` commit `4b10a434f5b60216608da74303d4193bc289e372`

## Context

The Pages workflow builds and deploys only the Vite client. GitHub Pages cannot provide the Express API, authentication, PostgreSQL, Redis, model adapters, background processing, local integrations, or server-side security controls. The client contains a static-build detector and hides some backend-dependent areas, but the Pages deployment has not been certified and cannot represent the complete product.

## Decision

GitHub Pages is retained only as an **optional static product demonstration**.

1. Pages is not a production deployment and must never be labeled as the full application.
2. The demo must show a persistent, visible limitation notice.
3. Backend-dependent and privileged controls must be disabled, not merely allowed to fail.
4. The build must contain no provider credentials, application secrets, private endpoints, private documents, or production user data.
5. The demo may use bundled non-sensitive sample data or deterministic browser-only examples.
6. A future separately hosted API must not be connected to Pages without a new security review covering authentication, CORS, CSRF, abuse controls, data residency, and public-origin risk.
7. If the Pages configuration cannot meet these conditions, `P01-T05` must disable or remove the workflow rather than keep a misleading or failing deployment.

## Alternatives considered

### Treat Pages as the production frontend for the hosted API now

Rejected. The backend target, authentication flow, cross-origin policy, and deployed API are not certified.

### Remove Pages immediately

Not selected in this ADR because a clearly bounded static demo can be useful. `P01-T05` may still remove it if the repository cannot maintain the required demo behavior.

### Present a mock that visually imitates successful backend operations

Rejected. A mock may demonstrate layout but must not imply that server actions or external providers actually ran.

## Consequences

### Positive

- The project can retain a low-cost public demonstration without confusing it with production.
- Static hosting cannot accidentally become an unsupported backend architecture.
- Later Pages work has explicit acceptance criteria.

### Negative

- The demo will expose a smaller feature set than the local or hosted application.
- Demo-specific copy and disabled states must be maintained.
- The failing Pages workflow remains a Phase 1 blocker until repaired or removed.

## Security and data impact

- No secrets or personal data may be embedded in the static artifact.
- The demo must make no authenticated calls to privileged routes.
- Content Security Policy and dependency integrity remain required for the static artifact.

## Verification obligations

- `P01-T05`: repair Pages as a truthful static demo or remove it.
- `P03-T08`: include static package smoke for the demo artifact if retained.
- `P08-T01` and `P08-T02`: verify information architecture and unavailable-feature states.
- `P12-T02`: test the demo limitation notice and disabled backend behavior.
- `P13-T02`: do not publish Pages as a production release artifact.

## Unresolved assumptions

- Whether the demo remains worth maintaining will be decided in `P01-T05`.
- A custom domain is not selected.
- No separately hosted API origin is authorized by this ADR.

## Superseded decisions

None. This ADR rejects any informal interpretation of the current Pages workflow as a complete deployment.

## Repository evidence reviewed

- `.github/workflows/pages.yml`
- `client/src/api/runtime.ts`
- `docs/DEPLOYMENT_MODES.md`
- `docs/implementation/PRODUCTION_FEATURE_MANIFEST.md`
