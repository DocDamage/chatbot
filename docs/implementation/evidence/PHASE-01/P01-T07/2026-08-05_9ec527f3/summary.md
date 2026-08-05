# P01-T07 Evidence Summary

## Status

`BLOCKED`

The repository-side policy and reproducible configuration/verification script are implemented at commit `9ec527f3d635fa1bf02d1a8ffbaeeb46048eaeb1`, but the live `main` branch rule could not be applied or read back with the connected GitHub App. The app returns HTTP 403 for the branch-protection endpoint because it lacks the required repository **Administration: write** permission.

P01-T07 is not `VERIFIED`, and Phase 2 is not authorized.

## Baseline facts

- Repository: `DocDamage/chatbot`
- Baseline `main` commit: `929bc0fbeefe7bf9d8d296e94d954dbb9de2b790`
- Task branch: `agent/p01-t07-add-branch-protection`
- Repository-side implementation commit: `9ec527f3d635fa1bf02d1a8ffbaeeb46048eaeb1`
- `main` protection before this task: `protected: false`
- Repository rulesets before this task: none
- Current aggregate check: `Required CI gate`
- Check source: GitHub Actions, app ID `15368`
- Aggregate check conclusion on baseline `main`: `success`
- Direct collaborators: only `DocDamage`, role `admin`
- GitHub Pages environment: custom deployment branch policy allowing only `main`

## Implemented repository changes

- Added `docs/implementation/BRANCH_PROTECTION_POLICY.md` with exact required settings and decisions.
- Added `scripts/release/configure-main-branch-protection.mjs`.
- The script discovers the successful aggregate check, binds the required check to GitHub Actions app ID, prints a dry-run payload, applies the policy only with an explicit short-lived token, reads the full protection object back, and validates each requirement.
- The script is 191 lines and stays below the 300-line guideline.

## Intended live rule

- pull requests required;
- one approval required;
- stale approvals dismissed;
- latest push requires approval by someone else;
- strict, up-to-date status checks;
- `Required CI gate` required from GitHub Actions app ID `15368`;
- conversations resolved before merge;
- force pushes blocked;
- branch deletion blocked;
- owner-only admin bypass retained with `enforce_admins: false`;
- signed commits deferred because current connector-authored implementation commits are unsigned;
- Pages remains protected through its existing `main`-only environment policy and is not made a conditionally absent required check.

## Verification completed

- Node syntax check passed.
- Dry-run discovery/payload behavior passed with mocked GitHub API responses.
- Apply, full read-back, and required-field validation passed with mocked GitHub API responses.
- Live public read-back confirmed the baseline branch, check, collaborator, ruleset, and Pages environment facts.

## Blocking condition

GitHub's live branch-protection API requires an owner/admin token with repository `Administration: write`. The connected GitHub App cannot access that endpoint and returned:

```text
403 Resource not accessible by integration
```

No administration-capable token is available in the execution environment. Creating or exposing a token in repository files, workflow inputs, logs, or evidence would be insecure and is prohibited.

## Completion requirement

Run the committed configurator with a short-lived fine-grained token that has `Administration: write`, then preserve the successful live read-back. Only after `main` reports `protected: true` and every required field validates may P01-T07 be marked `VERIFIED`.
