# Branch reconciliation — November 2, 2026

The consolidation candidate is `codex/coding-alias-context` into `main`. All existing branches remain intact until review. The working checkout is `G:\dev\Chatbot`; no application changes are taken from the older duplicate checkout on `I:`.

## Audited history

The audit started from `main` at `266068db0c1ce4c8723e3e6fe1f851f07c37fe0f` and latest development at `33960a481b4f8c3a0eff382ac785f136703ebb18`. Commit counts below describe those fetched heads before this reconciliation commit.

| Branch | Ahead / behind main | Classification | Action |
| --- | --- | --- | --- |
| `main` | 0 / 0 | Existing canonical baseline | Preserve until consolidation is reviewed and required CI passes. |
| `codex/coding-alias-context` | 61 / 0 | Latest development; includes all five intermediate heads below | Use as the single consolidation PR head. |
| `codex/coding-reliability` | 54 / 0 | Ancestor of the consolidation candidate | Keep through review; cleanup candidate after consolidation merges. |
| `codex/rea-integration` | 52 / 0 | Ancestor of the consolidation candidate | Keep through review; cleanup candidate after consolidation merges. |
| `codex/daily-use-readiness` | 51 / 0 | Ancestor of the consolidation candidate | Keep through review; cleanup candidate after consolidation merges. |
| `feat/dabook-integration` | 50 / 0 | Ancestor of the consolidation candidate | Keep through review; cleanup candidate after consolidation merges. |
| `codex/cf04-cf10-integration` | 47 / 0 | Ancestor of the consolidation candidate; head of PR #171 | Preserve branch and PR while the consolidated replacement is reviewed. |
| `codex/fix-cf01-merge-cleanup` | 0 / 134 | Already contained in main and the consolidation candidate | Already-merged cleanup candidate; no deletion in this task. |
| `codex/cf03-findings` | 2 / 70 | Historical divergent implementation and documentation | Preserve for review; use the verified port described below instead of replaying the old implementation. |

The main development line is already sequential:

```text
main (266068d)
  -> CF-04–CF-10 / canonical chat runtime (ba6644d)
  -> DABOOK (e19cfea)
  -> daily local use (ada5d0e)
  -> REA (6d9f4b8)
  -> coding reliability / compiler and property checks (9241c4f)
  -> aliases / ingestion / operational follow-up (33960a4)
```

Main is an ancestor of the candidate, so consolidating these heads requires no intermediate branch merges or cherry-picks. GitHub's required CI and review remain separate from ancestry checks.

## Historical CF branch

The two commits unique to `codex/cf03-findings` are `3e1e4fb` (CF-04 through CF-10 implementation) and `70570b0` (documentation). The implementation was ported onto the newer baseline as `927215ccd17b3d2d14e5c5ff63d2b33048674087`, which is an ancestor of the consolidation candidate. The port preserves the newer CF-03 implementation rather than replaying older finding/index code.

All 107 paths touched by the historical implementation exist in the latest candidate; 53 still have identical contents, and the rest have changed through the port or later work. The port's tree differs in 23 paths, including the retained CF-03 files, generated inventories and handoff records. `git cherry` identifies the documentation commit as patch-equivalent to an existing candidate commit. These are provenance checks, not proof that every historical behavior is unchanged; review the port before deleting the historical branch.

## Existing PR and CI

[PR #171](https://github.com/DocDamage/chatbot/pull/171) targets main from the older integration head and remains open. Its latest checks include failures in dependency scanning, history secret scanning, client type checking, coverage, documentation/evidence validation and the final Required CI gate. Its title/body do not cover the later daily-use, REA, coding, alias and ingestion work. The consolidation PR is intended to replace it after review; this task does not close it.

Main requires a strict `Required CI gate`, resolved conversations, and enforces those rules for administrators. Force pushes and deletion are disabled on main. The consolidation stays a draft while review and fresh GitHub CI are pending. No merge, force push, reset, branch deletion or worktree cleanup is part of this preparation.

The current candidate passes the local repository-policy checks and the critical/high dependency gate for all five shipped Node runtime trees. These current checks supersede the older integration branch's dependency results; the detailed November 1 evidence remains in [project status](PROJECT_STATUS.md).

The history secret scan initially reported three occurrences of two synthetic test values from `ba6644d`. Both values are hardcoded redaction fixtures: one has a repeated-digit suffix, and one has an ordered-alphabet/digit suffix. The exact reviewed fingerprints and original test paths/lines are documented in `config/secret-scan-allowlist.json`. Only those two fingerprints were added to the existing allowlist; scanner patterns and history coverage remain unchanged. No credential value is reproduced in this report.

Live Ollama evaluation of the newest follow-up remains deferred at the user's request because Ollama is on the other PC. This branch task does not run it or treat a missing local Ollama service as an evaluation result. Published-book extraction and training limitations remain documented in the existing evidence; this PR does not establish hosted production readiness or a useful fine-tuned model.

Local checks on November 2:

| Check | Result |
| --- | --- |
| `npm run check:phase2` | Passed: release-tool tests, source integrity, current inventory, reachability, file-size, environment and documentation gates. |
| `npm run check:dependencies` | Passed: zero findings in each shipped server, client, desktop-companion, coding-tools and REA Node runtime tree; development deepmerge patch checks passed. |
| `npm run check:secrets:history` | Passed over current files and the complete fetched Git history after the two reviewed fixture fingerprints were added. |
| `git diff --check` | Passed. |
| Fresh GitHub Required CI | Pending the consolidation PR; no passing exact-head CI is claimed. |

Application source and dependency versions are unchanged by this reconciliation commit. The prior November 1 implementation test/build evidence remains historical validation, not a substitute for the new PR's required checks.

## Checkout guidance and cleanup order

- `G:\dev\Chatbot` already contains the latest candidate and was clean at the start of this task.
- `I:\Coding Projects\ChatBot` is a separate clone checked out at `178224d`; it is 15 commits behind the audited latest development tip. It is left unchanged apart from fetching remote refs for inspection.
- Review and validate the single consolidation PR first. Merge only after the required checks and review are satisfied.
- After merge, compare the retained remote branch heads against main again. Remove redundant ancestor branches only in a separately authorized cleanup; retain or archive the historical CF branch until its port is reviewed.
- Future work can start from an updated main in short-lived branches rather than extending the current chain indefinitely.
