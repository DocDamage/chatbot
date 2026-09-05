/**
 * Cross-Branch Memory Reconciliation & Lifecycle Service (PX-05 / PX05-T07)
 *
 * Manages branch memory propagation:
 * - Unmerged branch memories stay branch-scoped
 * - Merged branch memories can be promoted to base branch ('main')
 * - Abandoned/closed branch memories are quarantined
 * - Deduplication across cherry-picks and rebases
 */

import { ProjectMemoryStore } from '../capture/ProjectMemoryStore';
import { ProjectMemoryRecord } from '../capture/ProjectMemorySchema';

export class BranchMemoryReconciler {
  constructor(private readonly store: ProjectMemoryStore) {}

  /**
   * Promote all memories from a feature branch to the target base branch (e.g. 'main') upon PR merge.
   */
  public reconcileBranchMerge(sourceBranch: string, targetBranch = 'main', mergeCommitHash: string, requester: { userId: string; isAdmin?: boolean }): ProjectMemoryRecord[] {
    const branchMemories = this.store.query({ branch: sourceBranch }, requester);
    const promoted: ProjectMemoryRecord[] = [];

    for (const mem of branchMemories) {
      if (mem.freshnessState === 'deleted' || mem.freshnessState === 'quarantined') continue;

      mem.branch = targetBranch;
      mem.originatingCommit = mergeCommitHash;
      mem.tags = Array.from(new Set([...mem.tags, `promoted_from_${sourceBranch}`]));
      mem.updatedAt = new Date().toISOString();

      promoted.push(this.store.save(mem));
    }

    return promoted;
  }

  /**
   * Quarantine memories from an abandoned/closed feature branch.
   */
  public quarantineBranchMemories(sourceBranch: string, requester: { userId: string; isAdmin?: boolean }): ProjectMemoryRecord[] {
    const branchMemories = this.store.query({ branch: sourceBranch }, requester);
    const quarantined: ProjectMemoryRecord[] = [];

    for (const mem of branchMemories) {
      if (mem.branch === 'main' || mem.branch === 'master') continue; // Do not quarantine base branch

      mem.freshnessState = 'quarantined';
      mem.updatedAt = new Date().toISOString();
      quarantined.push(this.store.save(mem));
    }

    return quarantined;
  }
}
