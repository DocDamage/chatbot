import { ProjectMemoryStore } from '../capture/ProjectMemoryStore';
import { BranchMemoryReconciler } from '../reconciliation/BranchMemoryReconciler';
import { ProjectMemoryRecord } from '../capture/ProjectMemorySchema';

describe('RT-MEM-001..002 — Branch/Commit/Symbol Memory Lifecycle and Isolation Suite', () => {
  let store: ProjectMemoryStore;
  let reconciler: BranchMemoryReconciler;
  const adminUser = { userId: 'admin-user', isAdmin: true };

  beforeEach(() => {
    store = new ProjectMemoryStore();
    reconciler = new BranchMemoryReconciler(store);
  });

  const createRecord = (overrides: Partial<ProjectMemoryRecord>): ProjectMemoryRecord => ({
    id: 'mem-1',
    ownerId: 'dev-1',
    authorId: 'dev-1',
    projectId: 'proj-1',
    branch: 'main',
    originatingCommit: 'commit-1',
    kind: 'decision',
    title: 'Test memory',
    content: 'Test content',
    evidence: [],
    relatedFiles: [],
    relatedSymbols: [],
    confidence: 0.95,
    captureMethod: 'explicit_user',
    approvalState: 'approved',
    freshnessState: 'current',
    retentionClass: 'permanent',
    accessScope: 'project_shared',
    tags: ['test'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  it('keeps feature branch memories isolated to the branch', () => {
    store.save(createRecord({
      id: 'mem-feat-1',
      title: 'Added JWT validation',
      content: 'Configured JWT auth middleware',
      branch: 'feature/auth',
      tags: ['auth', 'jwt'],
    }));

    const mainMemories = store.query({ branch: 'main' }, adminUser);
    expect(mainMemories.length).toBe(0);

    const featMemories = store.query({ branch: 'feature/auth' }, adminUser);
    expect(featMemories.length).toBe(1);
  });

  it('promotes feature branch memories to target base branch upon PR merge', () => {
    store.save(createRecord({
      id: 'mem-feat-2',
      title: 'Added OAuth support',
      content: 'Configured OAuth client',
      branch: 'feature/oauth',
      tags: ['oauth'],
    }));

    const promoted = reconciler.reconcileBranchMerge('feature/oauth', 'main', 'commit-sha-merge-123', adminUser);
    expect(promoted.length).toBe(1);
    expect(promoted[0].branch).toBe('main');
    expect(promoted[0].originatingCommit).toBe('commit-sha-merge-123');

    const mainMemories = store.query({ branch: 'main' }, adminUser);
    expect(mainMemories.length).toBe(1);
  });

  it('quarantines memories when feature branch is abandoned', () => {
    store.save(createRecord({
      id: 'mem-feat-3',
      title: 'Abandoned experiment',
      content: 'Scrapped experimental approach',
      branch: 'feature/experiment',
      tags: ['exp'],
      confidence: 0.5,
    }));

    const quarantined = reconciler.quarantineBranchMemories('feature/experiment', adminUser);
    expect(quarantined.length).toBe(1);
    expect(quarantined[0].freshnessState).toBe('quarantined');
  });
});
