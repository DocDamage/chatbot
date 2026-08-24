# Capability Fusion — CF-05 Rolling Record

- Status: `LOCAL_ONLY_EXPERIMENTAL`
- Scope: Workstream CF-05 — Typed agent teams and isolated worktrees

> Audit correction (2026-08-24): The current lifecycle service creates contained directories, not real Git worktrees, and there is no bounded child-process/process-tree executor. Treat the checked items below as contract/prototype coverage, not completion evidence. See [CF-04_TO_CF-10_IMPLEMENTATION_AUDIT.md](./CF-04_TO_CF-10_IMPLEMENTATION_AUDIT.md).

## Workstreams & Deliverables

- [x] Defined typed roles: repository analyst, planner, implementer, test author, reviewer, security reviewer, and integration supervisor (`AgentTeamRoles.ts`).
- [x] Immutable task envelopes with scope, inputs, success criteria, authority, budget, and approval digest (`TaskEnvelope.ts`).
- [x] `AgentTeamCoordinator` task graph and dependency scheduler with budget caps, failure propagation, and stop-all cancellation (`AgentTeamCoordinator.ts`).
- [x] Isolated worktree sandbox lifecycle service with strict path containment and disk caps (`WorktreeLifecycleService.ts`).
- [x] Conflict detection and `ReviewerBundle` assembler (`ReviewerBundle.ts`).
- [x] Supervisor bypass prevention enforcing peer review, security review, and verification gates.
- [x] Architectural Decision Record ADR-0015 (`docs/implementation/decisions/ADR-0015-typed-agent-teams-and-worktrees.md`).
