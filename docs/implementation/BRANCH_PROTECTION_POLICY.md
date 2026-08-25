# Main Branch Protection Policy

## Current owner decision

On 2026-08-25, the repository owner authorized the recommended branch-protection baseline for `DocDamage/chatbot`, superseding the 2026-08-05 waiver.

## Verified live state

GitHub API read-back confirms that `main` is protected with:

- pull requests required before protected-branch updates;
- strict/up-to-date status checks;
- required `Required CI gate` from GitHub Actions app ID `15368`;
- protections enforced for administrators;
- required conversation resolution;
- force pushes blocked; and
- branch deletion blocked.

The required approving-review count is zero so a single-maintainer repository is not locked out. Independent human review remains a process requirement for Capability Fusion and production promotion even though GitHub does not enforce a second account.

## Retained tooling

`scripts/release/configure-main-branch-protection.mjs` remains the reproducible policy configurator. Live API read-back, rather than script presence, is the verification source.

## Change control

Any relaxation of required checks, strictness, administrator enforcement, conversation resolution, force-push denial, or deletion denial requires a new owner decision and must be recorded in the production tracker and release evidence.

## Release-gate integrity

Branch protection complements rather than replaces tests, CI jobs, security controls, coverage policies, evidence requirements, runtime QA, and release approval.
