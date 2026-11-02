# ADR-0015: Typed Agent Teams and Isolated Worktrees

- Status: Accepted
- Date: 2026-08-24
- Scope: Capability Fusion / CF-05
- Maturity: `LOCAL_ONLY_EXPERIMENTAL`

## Decision

CF-05 delivers controlled parallel multi-agent development teams and isolated worktree sandboxes to ensure that concurrent development cannot corrupt the primary checkout, evade review gates, or exceed resource budgets.

1. **Typed Agent Roles as Capabilities**:
   Roles are defined by explicit capabilities and least-privilege toolsets: `repository_analyst`, `planner`, `implementer`, `test_author`, `reviewer`, `security_reviewer`, and `integration_supervisor`.
2. **Immutable Task Envelopes**:
   Every work item is wrapped in an immutable `TaskEnvelope` with defined inputs, scopes, success criteria, budgets, dependencies, and a cryptographic SHA-256 `approvalDigest`.
3. **Isolated Worktree Sandboxes**:
   Mutation workers (`implementer`, `test_author`) operate strictly within ephemeral isolated worktrees managed by `WorktreeLifecycleService`. All file modifications, creates, and deletes are contained within the sandbox. Path traversal escapes (`..`), null bytes, `.git` mutations, and symlink escapes are strictly blocked.
4. **Task Graph & Failure Propagation**:
   `AgentTeamCoordinator` resolves task DAGs, enforces concurrency limits, and automatically propagates failure to downstream dependents while preserving partial results.
5. **Supervisor Bypass Protection**:
   `integration_supervisor` is architecturally prohibited from merging or applying changes unless both peer review (`reviewer`) and security review (`security_reviewer`) signoffs are present, cryptographically verified, and conflict-free.
6. **Cancellation & Budgets**:
   Global `stopAll()` and task-level cancellations terminate active execution trees and clean up ephemeral worktree sandboxes.

## Boundaries and Security Invariants

- **Clean License Boundary**: No noncommercial or proprietary dev-house source code is copied into the repository. Role definitions and scheduler patterns are independently implemented clean-room contracts.
- **Repository Integrity**: The primary repository checkout is never directly mutated by parallel workers. All modifications must be reviewed as a complete `ReviewerBundle`.
- **Authority Preservation**: No new shell, arbitrary file write outside worktrees, or Git write authority is granted.
