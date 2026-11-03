# Current handoff — November 2, 2026

Work is in `G:\dev\Chatbot`, branch `codex/daily-use-automation`, based on merged
main `8357018`. The user authorized finishing daily-use setup, installing startup and
backups, comparing the two Ollama models, fixing gaps, testing, committing and pushing.

Current-user Windows tasks are installed: **Chatbot Local Startup** at sign-in and
**Chatbot Local Backup** at sign-in plus 20:00 local time. Task stop kills the owned
Node tree. Backups default to C: user data, separate from the removable project drive;
retention is 14 days / at most 30 verified copies, always preserving the newest.

Ordinary chat uses qwen3:8b. The ignored local `.env` selects qwen3-coder:30b for coding.
The full comparison passed 8/9 and 9/9 cases respectively. The 8B property-test failure
is recorded, not hidden. Core chat, restart, actual backup restoration and document
answers passed. See [daily-use evidence](../evidence/daily-use/2026-11-02/README.md) and
[daily-use setup](../../DAILY_USE.md). This remains local personal use; general autonomous
coding, useful fine-tuning and hosted production certification are not claimed.

## Next authorized task

Review the daily-use follow-up and its exact pushed-head CI. Fix any remaining CI
failure before reporting completion. Leave main unmerged unless the user instructs
otherwise. Do not delete the active follow-up branch before its review and merge.

## NEW THREAD START PROMPT

Continue the daily-use automation work on codex/daily-use-automation in G:\dev\Chatbot.
Read the November 2 evidence and inspect current PR checks before changing anything.
Preserve the local configuration, running scheduled app and private backups. Model
comparison is complete; 30B is selected for coding and 8B for ordinary chat. Finish
remaining verification, commit/push work if needed, and report the actual check results.

## Thread closure

The local setup is installed and tested. Final review and exact-head CI remain separate
from local evidence. Main merge is the user's decision. Earlier consolidation records
are historical and do not replace the follow-up's validation.
