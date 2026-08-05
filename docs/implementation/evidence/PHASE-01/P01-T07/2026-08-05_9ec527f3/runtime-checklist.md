# P01-T07 Runtime Checklist

## Baseline read-back

- [x] Confirm repository is `DocDamage/chatbot`.
- [x] Confirm default branch is `main`.
- [x] Confirm baseline `main` commit is `929bc0fbeefe7bf9d8d296e94d954dbb9de2b790`.
- [x] Confirm `main` reports `protected: false` before implementation.
- [x] Confirm no repository ruleset currently applies.
- [x] Confirm `Required CI gate` exists and passed on current `main`.
- [x] Confirm the check comes from GitHub Actions app ID `15368`.
- [x] Confirm only `DocDamage` has direct administrator access.
- [x] Confirm Pages deployment remains limited to `main` through the `github-pages` environment.

## Repository-side implementation

- [x] Exact branch-protection policy documented.
- [x] One-review requirement encoded.
- [x] Strict required-check requirement encoded.
- [x] Conversation-resolution requirement encoded.
- [x] Force-push prohibition encoded.
- [x] Branch-deletion prohibition encoded.
- [x] Owner-only admin exception documented and encoded.
- [x] Signed-commit deferral documented.
- [x] Pages boundary preserved.
- [x] Configurator syntax passed.
- [x] Dry-run behavior passed with mocked GitHub API responses.
- [x] Apply and live-read-back assertions passed with mocked GitHub API responses.

## Required live verification

- [ ] Apply the rule to `main` through an identity with `Administration: write`.
- [ ] Read the complete protection object back through GitHub's API.
- [ ] Confirm `main` reports `protected: true`.
- [ ] Confirm strict `Required CI gate` binding to app ID `15368`.
- [ ] Confirm one approval, stale-review dismissal, and latest-push approval.
- [ ] Confirm conversation resolution.
- [ ] Confirm force pushes and deletion are blocked.
- [ ] Confirm owner-only admin bypass remains the only practical exception.
- [ ] Test a pull request against the live rule.

## Result

`BLOCKED`

The connected GitHub App returns HTTP 403 for the branch-protection administration endpoint. Live application and read-back are mandatory and cannot be replaced by mocks or documentation.
