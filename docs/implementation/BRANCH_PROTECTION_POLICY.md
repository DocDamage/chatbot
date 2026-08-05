# Main Branch Protection Policy

## Scope

This policy applies only to the `main` branch of `DocDamage/chatbot` and implements the intended settings for `P01-T07 — Add branch protection`.

## Required live settings

| Control | Required value | Rationale |
|---|---|---|
| Pull request required | Enabled | Direct non-admin changes must not reach `main`. |
| Required approvals | 1 | Release-critical changes require another reviewer when a non-admin contributes. |
| Dismiss stale approvals | Enabled | An approval must not survive later code changes. |
| Latest push approval | Enabled | The person who made the latest push cannot satisfy the final review requirement. |
| Required status check | `Required CI gate` | This aggregate check rejects the merge unless every current required CI job succeeds. |
| Required check source | GitHub Actions app ID discovered from the current successful check run | Prevents a different app from spoofing the same check name. |
| Strict status checks | Enabled | Pull-request branches must be up to date with `main` before merge. |
| Conversation resolution | Enabled | Review conversations must be resolved before merge. |
| Force pushes | Disabled | Prevents history replacement on `main`. |
| Branch deletion | Disabled | Prevents deletion of `main`. |
| Admin enforcement | Disabled | Preserves the documented owner-only emergency exception for this personal, single-admin repository. |
| Signed commits | Not enabled | Current connector-authored implementation commits are unsigned; enabling this now would break the established task workflow. |
| Linear history | Not required | Not part of P01-T07 and the repository currently allows merge commits. |

## Owner-only exception decision

`DocDamage/chatbot` is a personal repository with one direct collaborator, `DocDamage`, and that account is the sole administrator. GitHub user/team bypass lists for classic branch protection are organization-only. Therefore, the narrow practical exception is to leave admin enforcement disabled.

This means:

- all non-admin collaborators must use pull requests, pass `Required CI gate`, obtain one approval, update their branch, and resolve conversations;
- the sole owner/admin can bypass in an emergency;
- any future additional administrator expands this exception and must trigger a policy review.

The exception must not be described as fully non-bypassable protection.

## Signed-commit decision

Required signed commits are deferred. The current workflow creates task implementation commits through the GitHub contents API, and verified evidence shows those implementation commits can be unsigned even though GitHub-generated merge commits are signed. Enabling signed commits before the automation path is updated would block normal task delivery.

Reconsider signed-commit enforcement when all supported commit-producing paths generate verified signatures.

## GitHub Pages boundary

The `github-pages` environment remains protected by a custom deployment branch policy that permits only `main`. The Pages workflow is a static-demo deployment, not the complete production application.

`Deploy GitHub Pages / build` is not a required branch status check because the workflow is path-filtered. Requiring a conditionally absent check would block unrelated pull requests indefinitely. Pages remains protected through its environment branch policy and deployment workflow.

## Reproducible application and verification

Use:

```bash
node scripts/release/configure-main-branch-protection.mjs
```

The command performs a public dry run, discovers the current successful `Required CI gate`, and prints the exact payload without changing settings.

To apply and verify live protection, provide a short-lived fine-grained token with **Administration: write** permission for this repository:

```bash
BRANCH_PROTECTION_TOKEN='<token>' \
  node scripts/release/configure-main-branch-protection.mjs --apply
```

The script applies the rule, reads the full protection object back through the GitHub API, validates every required field, then confirms that `main` reports `protected: true`.

Do not commit, print, or store the token in repository files, logs, evidence, or shell history.
