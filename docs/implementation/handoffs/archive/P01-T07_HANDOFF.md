# P01-T07 Handoff

## Repository state

- Repository: `DocDamage/chatbot`
- Baseline `main` commit: `929bc0fbeefe7bf9d8d296e94d954dbb9de2b790`
- Task branch: `agent/p01-t07-add-branch-protection`
- Repository-side implementation commit: `9ec527f3d635fa1bf02d1a8ffbaeeb46048eaeb1`
- Draft pull request: `#154`
- Evidence path: `docs/implementation/evidence/PHASE-01/P01-T07/2026-08-05_9ec527f3`
- Date: `2026-08-05`

## Authorized task

- Task ID: `P01-T07`
- Title: Add branch protection
- Status: `BLOCKED`

## Scope completed

- Inspected the current `main` branch, successful check runs, repository rulesets, direct collaborators, and Pages environment policy.
- Confirmed that `main` is currently unprotected and no repository ruleset exists.
- Identified the exact required aggregate check as `Required CI gate`, produced by GitHub Actions app ID `15368`.
- Documented the exact intended protection policy.
- Added a reproducible script that performs dry-run discovery, applies the rule with an administration-capable token, reads the live rule back, and validates every required field.
- Preserved the existing Pages environment boundary.
- Did not change CI commands and did not begin Phase 2.

## Files changed

- `docs/implementation/BRANCH_PROTECTION_POLICY.md`: exact settings, owner exception, signed-commit decision, and Pages boundary.
- `scripts/release/configure-main-branch-protection.mjs`: dry-run, live apply, and API read-back verification.
- `docs/implementation/evidence/PHASE-01/P01-T07/2026-08-05_9ec527f3/`: blocked-task evidence.
- Current and archived handoffs: task status and restart instructions.

## Intended live behavior

The `main` branch must require:

- a pull request;
- one approving review;
- stale-review dismissal;
- approval after the latest push by someone other than the pusher;
- strict, up-to-date `Required CI gate` from GitHub Actions app ID `15368`;
- resolution of all review conversations;
- blocked force pushes;
- blocked branch deletion.

The personal repository has one administrator, `DocDamage`. Classic branch protection cannot create a user-specific bypass list for a personal repository, so the narrow practical owner exception is `enforce_admins: false`.

Signed commits are not enabled because current connector-authored implementation commits are unsigned. The existing `github-pages` environment remains limited to `main`; its path-filtered build is not added as a universally required status check.

## Tests and verification completed

| Command or API call | Exit/status | Result |
|---|---:|---|
| `GET /repos/DocDamage/chatbot/branches/main` | 200 | `protected: false`; baseline SHA confirmed. |
| `GET /repos/DocDamage/chatbot/rulesets` | 200 | No rulesets. |
| Current commit check-runs read-back | 200 | `Required CI gate` passed; app ID `15368`. |
| Direct collaborator read-back | 200 | Only `DocDamage`, role `admin`. |
| Pages environment and branch-policy read-back | 200 | Custom policy permits only `main`. |
| `GET /branches/main/protection` through connected app | 403 | Administration endpoint unavailable to the integration. |
| `node --check` | 0 | Configurator syntax passed. |
| Dry-run mock | 0 | Discovery and exact payload passed. |
| Apply/read-back mock | 0 | PUT payload, authorization, full verification, and final protected state passed. |

## Blocking condition

The connected GitHub App lacks repository `Administration: write`. GitHub returned:

```text
403 Resource not accessible by integration
```

No administration-capable token is available in the execution environment. Live application and live API read-back are mandatory, so P01-T07 cannot be marked `VERIFIED` from documentation or mocks.

## Required completion action

Run from a trusted local environment with a short-lived fine-grained token that has **Administration: write** for `DocDamage/chatbot`:

```bash
BRANCH_PROTECTION_TOKEN='<token>' \
  node scripts/release/configure-main-branch-protection.mjs --apply
```

Do not paste the token into chat or commit it. Preserve the successful output after sanitizing it, confirm `main` reports `protected: true`, test the rule on the draft pull request, then update the tracker/evidence/handoff and close issue `#35`.

## Tracker and release evidence status

- P01-T07 is not appended to `RELEASE_EVIDENCE_INDEX.md` because it is not verified.
- The verified-task count is unchanged.
- Phase 2 remains unauthorized.

## Next authorized task

- `P01-T07 — Add branch protection` remains the only authorized task until live application and read-back succeed.

## NEW THREAD START PROMPT

You are working on repository `DocDamage/chatbot`.

AUTHORIZED TASK ONLY:
`P01-T07 — Add branch protection` (resume blocked live verification)

Read before acting:
1. `docs/implementation/handoffs/CURRENT_HANDOFF.md`
2. `docs/implementation/BRANCH_PROTECTION_POLICY.md`
3. `scripts/release/configure-main-branch-protection.mjs`
4. `docs/implementation/evidence/PHASE-01/P01-T07/2026-08-05_9ec527f3/`
5. GitHub issue `#35`
6. draft pull request `#154`

Requirements:
- Work only on P01-T07.
- Do not change CI commands or begin P02-T01.
- Use a trusted identity with repository `Administration: write`; never paste, print, commit, or log a token.
- Apply the committed exact policy to `main`.
- Read the complete live protection object back through the GitHub API.
- Confirm `main` reports `protected: true`.
- Confirm strict `Required CI gate` binding to GitHub Actions app ID `15368`.
- Confirm one review, stale-review dismissal, latest-push approval, conversation resolution, no force pushes, and no deletion.
- Preserve the owner-only admin exception and signed-commit deferral documented in the policy.
- Preserve the existing Pages protected deployment boundary.
- Test the live rule with pull request `#154` or an equivalent safe probe.
- Only after live verification: update the master tracker, append the release evidence index, replace and archive the handoff, close issue `#35`, and authorize only `P02-T01` in a new thread.
- End the thread after P01-T07 is verified or remains formally blocked.

Completion requires live GitHub settings read-back and evidence against the exact commit. Mocks and narrative claims are insufficient.

## Thread closure

This thread is closed. Do not begin another task here. Start a new Codex thread using the prompt above after an administration-capable GitHub identity is available.
