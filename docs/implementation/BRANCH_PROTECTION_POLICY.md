# Main Branch Governance Decision

## Owner decision

On 2026-08-05, the repository owner explicitly declined branch-protection enforcement for `DocDamage/chatbot`.

The intended P01-T07 controls are therefore **waived**, not verified. The waiver removes P01-T07 as a sequencing blocker but does not count the task toward verified completion.

## Live state

- `main` is intentionally unprotected.
- The active `chatrules` ruleset targets the default branch but contains zero rules.
- Pull-request requirements, approvals, required status checks, conversation resolution, force-push restrictions, and deletion restrictions are not enforced by repository rules.
- CI remains available and should still be used for development verification, but it is not a GitHub merge-enforcement requirement.

## Retained tooling

`scripts/release/configure-main-branch-protection.mjs` is retained only as an opt-in future configurator. Its presence does not authorize or imply live branch protection.

## Reconsideration triggers

Review this waiver before:

- adding collaborators or administrators;
- accepting outside contributions;
- publishing a production release;
- delegating repository maintenance;
- relying on `main` as an automatically deployed production source.

## Release-gate integrity

Waiving GitHub branch rules does not authorize weakening tests, CI jobs, security controls, coverage policies, evidence requirements, or runtime QA. Those controls remain independent engineering requirements unless the repository owner separately changes them.
