# P01-T07 Commands and API Calls

| Command or API call | Exit/status | Result |
|---|---:|---|
| `GET /repos/DocDamage/chatbot/branches/main` | 200 | Baseline `main` SHA `929bc0fbeefe7bf9d8d296e94d954dbb9de2b790`; `protected: false`. |
| `GET /repos/DocDamage/chatbot/rulesets` | 200 | Returned `[]`; no repository rulesets exist. |
| `GET /repos/DocDamage/chatbot/commits/929bc0f.../check-runs` | 200 | Found 16 checks; `Required CI gate` passed and was produced by GitHub Actions app ID `15368`. |
| `GET /repos/DocDamage/chatbot/collaborators?affiliation=direct&per_page=100` | 200 | Only direct collaborator is `DocDamage`, role `admin`. |
| `GET /repos/DocDamage/chatbot/environments/github-pages` | 200 | Existing custom deployment branch policy preserved. |
| `GET /repos/DocDamage/chatbot/environments/github-pages/deployment-branch-policies` | 200 | Only allowed deployment branch is `main`. |
| `GET /repos/DocDamage/chatbot/branches/main/protection` through connected GitHub App | 403 | `Resource not accessible by integration`; live administration endpoint unavailable. |
| `node --check /tmp/p01-t07-configure.mjs` | 0 | Configurator syntax passed under Node `v22.16.0`. |
| `node /tmp/p01-t07-dry-test.mjs` | 0 | Dry-run discovery and payload mock passed. |
| `node /tmp/p01-t07-apply-test.mjs` | 0 | Apply, authorization header, payload, read-back, and post-update branch-state mock passed. |
| `curl` raw branch file from isolated container | 6 | Container DNS could not resolve `raw.githubusercontent.com`; no repository defect. File was validated from the committed content using a local copy. |

## Live application command prepared but not executed

```bash
BRANCH_PROTECTION_TOKEN='<short-lived-token-with-Administration-write>' \
  node scripts/release/configure-main-branch-protection.mjs --apply
```

The command was not executed because no administration-capable token was available. No token was requested in chat, stored, printed, or committed.
