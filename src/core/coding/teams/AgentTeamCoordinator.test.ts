import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  AgentTeamCoordinator,
  AgentTeamRole,
  assertRoleAuthority,
  AgentRoleAuthorityError,
  createTaskEnvelope,
  verifyTaskEnvelope,
  WorktreeLifecycleService,
  WorktreeContainmentError,
  assembleReviewerBundle,
  createReviewSignoff,
  supervisorApproveMerge,
  SupervisorBypassError,
  detectMutationsConflicts
} from './index';

describe('CF-05 Typed Agent Teams & Isolated Worktrees', () => {
  let tempBaseDir: string;
  let worktreeService: WorktreeLifecycleService;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf05-worktrees-'));
    worktreeService = new WorktreeLifecycleService({ baseDir: tempBaseDir });
  });

  afterEach(() => {
    worktreeService.cleanupAll();
    if (fs.existsSync(tempBaseDir)) {
      try {
        fs.rmSync(tempBaseDir, { recursive: true, force: true });
      } catch {
        // cleanup
      }
    }
  });

  describe('AgentTeamRoles & Authority Matrix', () => {
    it('allows authorized actions for each role', () => {
      expect(() => assertRoleAuthority('repository_analyst', 'read_file')).not.toThrow();
      expect(() => assertRoleAuthority('repository_analyst', 'query_architecture')).not.toThrow();
      expect(() => assertRoleAuthority('implementer', 'write_file')).not.toThrow();
      expect(() => assertRoleAuthority('test_author', 'run_tests')).not.toThrow();
      expect(() => assertRoleAuthority('security_reviewer', 'scan_secrets')).not.toThrow();
      expect(() => assertRoleAuthority('integration_supervisor', 'assemble_bundle')).not.toThrow();
    });

    it('rejects unauthorized actions', () => {
      expect(() => assertRoleAuthority('repository_analyst', 'write_file')).toThrow(AgentRoleAuthorityError);
      expect(() => assertRoleAuthority('reviewer', 'write_file')).toThrow(AgentRoleAuthorityError);
      expect(() => assertRoleAuthority('security_reviewer', 'create_patch')).toThrow(AgentRoleAuthorityError);
    });
  });

  describe('TaskEnvelope & Cryptographic Digest', () => {
    it('creates a signed task envelope with a valid approval digest', () => {
      const envelope = createTaskEnvelope({
        role: 'implementer',
        title: 'Add local cache layer',
        description: 'Implement memory cache',
        scope: ['src/core/cache/**'],
        inputs: { algorithm: 'lru' }
      });

      expect(envelope.taskId).toBeDefined();
      expect(envelope.approvalDigest).toBeDefined();
      expect(verifyTaskEnvelope(envelope)).toBe(true);
    });

    it('detects tampering when envelope contents change', () => {
      const envelope = createTaskEnvelope({
        role: 'implementer',
        title: 'Safe Task',
        description: 'Do work'
      });

      expect(verifyTaskEnvelope(envelope)).toBe(true);

      // Mutate inputs property
      (envelope.inputs as any).tampered = true;
      expect(verifyTaskEnvelope(envelope)).toBe(false);
    });
  });

  describe('WorktreeLifecycleService & Containment (Adversarial Isolation Tests)', () => {
    it('isolates writes to worker sandbox and prevents path traversal', async () => {
      const envelope = createTaskEnvelope({
        role: 'implementer',
        title: 'Implement module',
        description: 'Write module code',
        scope: ['src/**']
      });

      await worktreeService.createWorktree(envelope, 'worker-1');

      // Allowed write inside worktree
      worktreeService.writeFile(envelope.taskId, 'src/module.ts', 'export const x = 1;');
      expect(worktreeService.readFile(envelope.taskId, 'src/module.ts')).toBe('export const x = 1;');

      // Block path traversal escape
      expect(() => {
        worktreeService.writeFile(envelope.taskId, '../../escape.txt', 'malicious');
      }).toThrow(WorktreeContainmentError);

      // Block null-byte injection
      expect(() => {
        worktreeService.writeFile(envelope.taskId, 'src/safe\0.txt', 'malicious');
      }).toThrow(WorktreeContainmentError);

      // Block .git mutation
      expect(() => {
        worktreeService.writeFile(envelope.taskId, '.git/config', 'tamper');
      }).toThrow(WorktreeContainmentError);

      // Block out-of-scope write
      expect(() => {
        worktreeService.writeFile(envelope.taskId, 'docs/notes.md', 'tamper');
      }).toThrow(WorktreeContainmentError);
    });

    it('enforces disk usage budgets', async () => {
      const envelope = createTaskEnvelope({
        role: 'implementer',
        title: 'Budget Test',
        description: 'Test budget',
        budget: { maxDiskBytes: 100 }
      });

      await worktreeService.createWorktree(envelope, 'worker-1');

      expect(() => {
        worktreeService.writeFile(envelope.taskId, 'large.txt', 'a'.repeat(200));
      }).toThrow(WorktreeContainmentError);
    });

    it('enforces exact scope boundaries and reports only real baseline mutations', async () => {
      const envelope = createTaskEnvelope({
        role: 'implementer',
        title: 'Scoped mutation test',
        description: 'Test exact path boundaries',
        scope: ['src/app.ts', 'src/features/**']
      });
      await worktreeService.createWorktree(envelope, 'worker-1');
      worktreeService.seedFile(envelope.taskId, 'src/app.ts', 'export const value = 1;');

      expect(worktreeService.getMutations(envelope.taskId)).toEqual([]);
      expect(() => worktreeService.writeFile(envelope.taskId, 'src/app.ts.evil', 'escape')).toThrow(WorktreeContainmentError);

      worktreeService.writeFile(envelope.taskId, 'src/app.ts', 'export const value = 2;');
      expect(worktreeService.getMutations(envelope.taskId)).toEqual([
        expect.objectContaining({ path: 'src/app.ts', operation: 'modify', previousContent: 'export const value = 1;' })
      ]);
    });
  });

  describe('AgentTeamCoordinator & DAG Scheduler', () => {
    it('executes task DAG in topological dependency order', async () => {
      const coordinator = new AgentTeamCoordinator({ worktreeService });

      const executedOrder: string[] = [];

      coordinator.registerWorker('repository_analyst', async (envelope) => {
        executedOrder.push(envelope.taskId);
        return {
          taskId: envelope.taskId,
          workerId: 'analyst-1',
          success: true,
          outputs: { analysis: 'complete' },
          tokensUsed: 100,
          timeTakenMs: 10,
          commandsRun: 0,
          completedAt: new Date().toISOString()
        };
      });

      coordinator.registerWorker('implementer', async (envelope, wt) => {
        executedOrder.push(envelope.taskId);
        wt.writeFile(envelope.taskId, 'src/new-feature.ts', 'export const ok = true;');
        return {
          taskId: envelope.taskId,
          workerId: 'impl-1',
          success: true,
          outputs: { feature: 'done' },
          tokensUsed: 200,
          timeTakenMs: 20,
          commandsRun: 0,
          completedAt: new Date().toISOString()
        };
      });

      coordinator.registerWorker('reviewer', async (envelope) => {
        executedOrder.push(envelope.taskId);
        return {
          taskId: envelope.taskId,
          workerId: 'reviewer-1',
          success: true,
          outputs: { review: 'approved' },
          tokensUsed: 50,
          timeTakenMs: 5,
          commandsRun: 0,
          completedAt: new Date().toISOString()
        };
      });

      const t1 = createTaskEnvelope({ taskId: 't1-analysis', role: 'repository_analyst', title: 'Analyze' , description: 'd' });
      const t2 = createTaskEnvelope({ taskId: 't2-impl', role: 'implementer', title: 'Implement', description: 'd', dependencies: ['t1-analysis'] });
      const t3 = createTaskEnvelope({ taskId: 't3-review', role: 'reviewer', title: 'Review', description: 'd', dependencies: ['t2-impl'] });

      const report = await coordinator.executePlan({
        tasks: [t3, t2, t1] // Out of order input to test DAG resolution
      });

      expect(report.status).toBe('completed');
      expect(executedOrder).toEqual(['t1-analysis', 't2-impl', 't3-review']);
      expect(report.completedTaskIds).toEqual(['t1-analysis', 't2-impl', 't3-review']);
      expect(report.bundle).toBeDefined();
      expect(report.bundle?.patches.length).toBe(1);
    });

    it('propagates failure to downstream dependent tasks', async () => {
      const coordinator = new AgentTeamCoordinator({ worktreeService });

      coordinator.registerWorker('repository_analyst', async (envelope) => {
        return {
          taskId: envelope.taskId,
          workerId: 'analyst-1',
          success: false,
          error: 'Repository root invalid',
          outputs: {},
          tokensUsed: 50,
          timeTakenMs: 5,
          commandsRun: 0,
          completedAt: new Date().toISOString()
        };
      });

      const t1 = createTaskEnvelope({ taskId: 'task-1', role: 'repository_analyst', title: 'T1', description: 'd' });
      const t2 = createTaskEnvelope({ taskId: 'task-2', role: 'implementer', title: 'T2', description: 'd', dependencies: ['task-1'] });

      const report = await coordinator.executePlan({ tasks: [t1, t2] });
      expect(report.status).toBe('failed');
      expect(report.failedTaskIds).toContain('task-1');
      expect(report.failedTaskIds).toContain('task-2');
    });

    it('supports stopAll cancellation', async () => {
      const coordinator = new AgentTeamCoordinator({ worktreeService });

      coordinator.registerWorker('implementer', async (envelope, wt, signal) => {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            resolve({
              taskId: envelope.taskId,
              workerId: 'w',
              success: true,
              outputs: {},
              tokensUsed: 10,
              timeTakenMs: 10,
              commandsRun: 0,
              completedAt: new Date().toISOString()
            });
          }, 5000);

          signal.addEventListener('abort', () => {
            clearTimeout(timer);
            const err = new Error('Aborted by stop-all');
            err.name = 'AbortError';
            reject(err);
          });
        });
      });

      const t1 = createTaskEnvelope({ taskId: 'long-task', role: 'implementer', title: 'Long task', description: 'd' });

      const execPromise = coordinator.executePlan({ tasks: [t1] });

      setTimeout(() => {
        coordinator.stopAll('Emergency stop');
      }, 50);

      const report = await execPromise;
      expect(report.status).toBe('cancelled');
      expect(report.cancelledTaskIds).toContain('long-task');
    });
  });

  describe('ReviewerBundle & Supervisor Bypass Prevention', () => {
    it('detects parallel mutation conflicts', () => {
      const patchA = {
        taskId: 't-1',
        workerId: 'w-1',
        mutations: [{ path: 'src/config.ts', operation: 'modify' as const, content: 'v1', hash: 'h1' }]
      };
      const patchB = {
        taskId: 't-2',
        workerId: 'w-2',
        mutations: [{ path: 'src/config.ts', operation: 'modify' as const, content: 'v2', hash: 'h2' }]
      };

      const conflicts = detectMutationsConflicts([patchA, patchB]);
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].path).toBe('src/config.ts');
    });

    it('prevents supervisor from bypassing peer or security review', () => {
      const envelope = createTaskEnvelope({ role: 'implementer', title: 'Code', description: 'd' });
      const patch = {
        taskId: envelope.taskId,
        workerId: 'w-1',
        mutations: [{ path: 'src/feature.ts', operation: 'create' as const, content: 'export const a = 1;', hash: 'h' }]
      };

      const bundle = assembleReviewerBundle({
        envelopes: [envelope],
        patches: [patch]
      });

      // Supervisor attempting to approve without review signoffs must throw
      expect(() => supervisorApproveMerge(bundle, 'supervisor-1')).toThrow(SupervisorBypassError);

      // Add only peer review signoff
      bundle.peerReview = createReviewSignoff({
        reviewerRole: 'reviewer',
        reviewerId: 'peer-1',
        approved: true,
        comments: ['Looks great']
      });

      // Still throws because security review is missing
      expect(() => supervisorApproveMerge(bundle, 'supervisor-1')).toThrow(SupervisorBypassError);

      // Add security review signoff
      bundle.securityReview = createReviewSignoff({
        reviewerRole: 'security_reviewer',
        reviewerId: 'sec-1',
        approved: true,
        comments: ['No secrets or vulnerabilities found']
      });

      // Now supervisor approval succeeds
      const approvedBundle = supervisorApproveMerge(bundle, 'supervisor-1');
      expect(approvedBundle.supervisorApproved).toBe(true);
      expect(approvedBundle.status).toBe('merged');
      expect(approvedBundle.mergedAt).toBeDefined();
    });

    it('supports single-agent fallback execution', async () => {
      const coordinator = new AgentTeamCoordinator({ worktreeService });
      const order: string[] = [];

      coordinator.registerWorker('implementer', async (envelope) => {
        order.push(envelope.taskId);
        return {
          taskId: envelope.taskId,
          workerId: 'single-worker',
          success: true,
          outputs: { done: true },
          tokensUsed: 50,
          timeTakenMs: 5,
          commandsRun: 0,
          completedAt: new Date().toISOString()
        };
      });

      const t1 = createTaskEnvelope({ taskId: 't1', role: 'implementer', title: 'Task 1', description: 'd' });
      const t2 = createTaskEnvelope({ taskId: 't2', role: 'implementer', title: 'Task 2', description: 'd' });

      const report = await coordinator.executeSingleAgentFallback({ tasks: [t1, t2] });
      expect(report.status).toBe('completed');
      expect(order).toEqual(['t1', 't2']);
    });

    it('supports seeding files from workspace into worktree', async () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-root-'));
      try {
        fs.writeFileSync(path.join(root, 'source.ts'), 'export const base = 10;');
        const envelope = createTaskEnvelope({ role: 'implementer', title: 'Seed', description: 'd' });
        await worktreeService.createWorktree(envelope, 'worker-1');

        worktreeService.seedFromWorkspace(envelope.taskId, root, ['source.ts']);
        expect(worktreeService.readFile(envelope.taskId, 'source.ts')).toBe('export const base = 10;');
        expect(() => worktreeService.seedFromWorkspace(envelope.taskId, root, ['../outside-secret.txt'])).toThrow(WorktreeContainmentError);
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    });
  });
});
