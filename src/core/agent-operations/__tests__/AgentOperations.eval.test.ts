/**
 * Agent Operations & Workspace Coordination Evaluation Suite (PX-06)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  AgentPrivacyRedactor,
  AgentSessionHelper,
  SessionDiscoveryAdapter,
  AgentCommunicationHub,
  WorkspaceClaimService,
  WorkspaceClaimConflictError,
  AgentEvidenceBundleService,
  AgentOperationsConsoleService
} from '../index';
import { createTaskEnvelope } from '../../coding/teams/TaskEnvelope';

describe('Agent Operations & Workspace Coordination (PX-06)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'px06-agent-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Cleanup best effort
    }
  });

  describe('PX06-T09: AgentPrivacyRedactor', () => {
    it('redacts sensitive API keys, tokens, and bearer credentials', () => {
      const sensitiveText =
        'Authorization: Bearer sk-ant-api03-abcdef12345678901234567890\n' +
        'Set API_KEY="sk-1234567890abcdef12345678" in env.';
      const redacted = AgentPrivacyRedactor.redactString(sensitiveText, false);

      expect(redacted).not.toContain('sk-ant-api03');
      expect(redacted).not.toContain('sk-1234567890');
      expect(redacted).toContain('Bearer [REDACTED_TOKEN]');
      expect(redacted).toContain('[REDACTED_SECRET]');
    });

    it('anonymizes local home directory paths', () => {
      const pathWithHome = 'C:\\Users\\john_doe\\project\\src\\index.ts or /home/alice/repo';
      const redacted = AgentPrivacyRedactor.redactString(pathWithHome, true);

      expect(redacted).not.toContain('john_doe');
      expect(redacted).not.toContain('/home/alice');
      expect(redacted).toContain('~\\project\\src\\index.ts');
    });

    it('recursively redacts nested objects and sensitive keys', () => {
      const payload = {
        apiKey: 'secret_12345',
        nested: {
          password: 'pass',
          normalData: 'hello world'
        }
      };

      const redacted = AgentPrivacyRedactor.redactObject(payload);
      expect(redacted.apiKey).toBe('[REDACTED_SECRET]');
      expect(redacted.nested.password).toBe('[REDACTED_SECRET]');
      expect(redacted.nested.normalData).toBe('hello world');
    });
  });

  describe('PX06-T01: Normalized Session & Event Schema', () => {
    it('creates a normalized session with default permissions and budgets', () => {
      const session = AgentSessionHelper.createSession({
        agentId: 'agent-implementer-1',
        role: 'implementer',
        ownerId: 'user-101',
        projectId: 'project-42'
      });

      expect(session.sessionId).toBeDefined();
      expect(session.state).toBe('active');
      expect(session.currentStage).toBe('init');
      expect(session.permissions.readOnly).toBe(false);
      expect(session.budget.maxTokens).toBe(100000);

      const digest = AgentSessionHelper.computeSessionDigest(session);
      expect(digest).toHaveLength(64);
    });

    it('creates bounded and redacted events', () => {
      const session = AgentSessionHelper.createSession({
        agentId: 'agent-reviewer-1',
        role: 'reviewer',
        ownerId: 'user-101',
        projectId: 'project-42'
      });

      const event = AgentSessionHelper.createEvent(
        session,
        'tool_call',
        'file_system',
        'Reading file with token sk-1234567890abcdef12345678',
        { token: 'secret' }
      );

      expect(event.redacted).toBe(true);
      expect(event.summary).not.toContain('sk-1234567890');
      expect(event.details?.token).toBe('[REDACTED_SECRET]');
    });
  });

  describe('PX06-T02: Session Discovery Adapters', () => {
    it('discovers session files only within approved roots', () => {
      const adapter = new SessionDiscoveryAdapter();
      const approvedRoot = path.join(tempDir, 'approved_sessions');
      fs.mkdirSync(approvedRoot);

      const sessionFile = path.join(approvedRoot, 'session-1.json');
      fs.writeFileSync(
        sessionFile,
        JSON.stringify({
          id: 'sess-100',
          version: '1.0.0',
          agentId: 'codex-bot',
          role: 'implementer',
          state: 'active'
        })
      );

      adapter.registerRoot({
        provider: 'codex',
        approvedRootPath: approvedRoot,
        enabled: true
      });

      const discovered = adapter.discoverSessions();
      expect(discovered).toHaveLength(1);
      expect(discovered[0].sessionId).toBe('sess-100');
      expect(discovered[0].isSupportedVersion).toBe(true);

      adapter.stopAll();
    });

    it('flags unsupported schema versions', () => {
      const adapter = new SessionDiscoveryAdapter();
      const approvedRoot = path.join(tempDir, 'approved_sessions_v2');
      fs.mkdirSync(approvedRoot);

      fs.writeFileSync(
        path.join(approvedRoot, 'session-invalid.json'),
        JSON.stringify({
          id: 'sess-future',
          version: '99.0.0',
          agentId: 'future-bot'
        })
      );

      adapter.registerRoot({
        provider: 'codex',
        approvedRootPath: approvedRoot,
        enabled: true
      });

      const discovered = adapter.discoverSessions();
      expect(discovered).toHaveLength(1);
      expect(discovered[0].isSupportedVersion).toBe(false);

      adapter.stopAll();
    });
  });

  describe('PX06-T03: Scoped Agent Communication Hub', () => {
    it('enforces multi-attribute boundary scoping (at least two criteria)', () => {
      const hub = new AgentCommunicationHub();

      // Only one criterion: should throw error
      expect(() => {
        hub.startThread({
          title: 'Single criterion thread',
          creatorAgentId: 'agent-1',
          scope: { projectId: 'proj-1' }
        });
      }).toThrow('Invalid thread scope');

      // Two criteria: should succeed
      const thread = hub.startThread({
        title: 'Valid scoped thread',
        creatorAgentId: 'agent-1',
        scope: { projectId: 'proj-1', taskId: 'task-100' }
      });

      expect(thread.threadId).toBeDefined();
      expect(thread.members.has('agent-1')).toBe(true);
    });

    it('delivers messages, handles inboxes, and acknowledges receipts', () => {
      const hub = new AgentCommunicationHub();
      hub.registerAgent('agent-1', 'implementer');
      hub.registerAgent('agent-2', 'reviewer');

      const thread = hub.startThread({
        title: 'Review Discussion',
        creatorAgentId: 'agent-1',
        initialMembers: ['agent-2'],
        scope: { projectId: 'proj-1', pathGlob: 'src/core/**' }
      });

      const msg = hub.sendMessage({
        threadId: thread.threadId,
        senderAgentId: 'agent-1',
        recipientAgentId: 'agent-2',
        content: 'Please review the patch for auth module with sk-1234567890abcdef12345678'
      });

      expect(msg.content).not.toContain('sk-1234567890');

      const inbox = hub.getInbox('agent-2', true);
      expect(inbox).toHaveLength(1);
      expect(inbox[0].messageId).toBe(msg.messageId);

      const ackResult = hub.acknowledgeMessage(thread.threadId, msg.messageId, 'agent-2');
      expect(ackResult).toBe(true);

      const unreadInbox = hub.getInbox('agent-2', true);
      expect(unreadInbox).toHaveLength(0);
    });

    it('supports waiting for next message with timeout', async () => {
      const hub = new AgentCommunicationHub();
      const thread = hub.startThread({
        title: 'Async Thread',
        creatorAgentId: 'agent-1',
        initialMembers: ['agent-2'],
        scope: { projectId: 'proj-1', subject: 'Architecture sync' }
      });

      const waitPromise = hub.waitForNextMessage(thread.threadId, 'agent-2', 500);

      // Send message shortly after
      setTimeout(() => {
        hub.sendMessage({
          threadId: thread.threadId,
          senderAgentId: 'agent-1',
          content: 'Hello Agent 2!'
        });
      }, 50);

      const receivedMsg = await waitPromise;
      expect(receivedMsg.content).toBe('Hello Agent 2!');
    });
  });

  describe('PX06-T04: Workspace & Worktree Claims', () => {
    it('acquires claims and prevents overlapping exclusive claims', () => {
      const claimService = new WorkspaceClaimService();

      const claim1 = claimService.acquireClaim({
        agentId: 'worker-1',
        sessionId: 'sess-1',
        projectId: 'project-1',
        worktreePath: '/tmp/worktree-1',
        pathScope: ['src/core/auth/**'],
        taskId: 'task-1',
        exclusive: true
      });

      expect(claim1.claimId).toBeDefined();

      // Conflicting path scope in same project
      expect(() => {
        claimService.acquireClaim({
          agentId: 'worker-2',
          sessionId: 'sess-2',
          projectId: 'project-1',
          pathScope: ['src/core/auth/login.ts'],
          taskId: 'task-2',
          exclusive: true
        });
      }).toThrow(WorkspaceClaimConflictError);

      // Non-conflicting path scope
      const claim3 = claimService.acquireClaim({
        agentId: 'worker-3',
        sessionId: 'sess-3',
        projectId: 'project-1',
        pathScope: ['src/core/gaming/**'],
        taskId: 'task-3',
        exclusive: true
      });

      expect(claim3.claimId).toBeDefined();
    });

    it('supports heartbeats and reaps stale claims', () => {
      const claimService = new WorkspaceClaimService();

      const claim = claimService.acquireClaim({
        agentId: 'worker-1',
        sessionId: 'sess-1',
        projectId: 'project-1',
        taskId: 'task-1',
        leaseTtlMs: 50 // 50ms TTL
      });

      expect(claimService.listClaimsForProject('project-1')).toHaveLength(1);

      // Wait 70ms for claim to expire
      return new Promise<void>(resolve => {
        setTimeout(() => {
          const reaped = claimService.reapStaleClaims();
          expect(reaped).toBe(1);
          expect(claimService.listClaimsForProject('project-1')).toHaveLength(0);
          resolve();
        }, 70);
      });
    });

    it('detects worktree path and branch collisions and handles explicit release', () => {
      const claimService = new WorkspaceClaimService();

      const claim1 = claimService.acquireClaim({
        agentId: 'worker-1',
        sessionId: 'sess-1',
        projectId: 'project-1',
        worktreePath: '/tmp/worktree-fixed',
        branch: 'feat/security',
        taskId: 'task-1',
        exclusive: true
      });

      expect(claimService.heartbeat(claim1.claimId, 'worker-1')).toBe(true);
      expect(claimService.heartbeat(claim1.claimId, 'wrong-worker')).toBe(false);
      expect(claimService.heartbeat('non-existent-claim', 'worker-1')).toBe(false);

      // Worktree collision
      expect(() => {
        claimService.acquireClaim({
          agentId: 'worker-2',
          sessionId: 'sess-2',
          projectId: 'project-1',
          worktreePath: '/tmp/worktree-fixed',
          taskId: 'task-2'
        });
      }).toThrow(WorkspaceClaimConflictError);

      // Branch collision
      expect(() => {
        claimService.acquireClaim({
          agentId: 'worker-3',
          sessionId: 'sess-3',
          projectId: 'project-1',
          branch: 'feat/security',
          taskId: 'task-3',
          exclusive: true
        });
      }).toThrow(WorkspaceClaimConflictError);

      expect(claimService.releaseClaim(claim1.claimId, 'wrong-worker')).toBe(false);
      expect(claimService.releaseClaim('non-existent-claim', 'worker-1')).toBe(false);
      expect(claimService.releaseClaim(claim1.claimId, 'worker-1')).toBe(true);

      const claim2 = claimService.acquireClaim({
        agentId: 'worker-4',
        sessionId: 'sess-4',
        projectId: 'project-1',
        taskId: 'task-4'
      });
      expect(claimService.releaseAllForSession('sess-4')).toBe(1);
    });
  });

  describe('PX06-T06 & PX06-T07: Console Service & Budget Stop Controls', () => {
    it('tracks active sessions, transitions stages, and records usage', () => {
      const consoleService = new AgentOperationsConsoleService();

      const session = consoleService.startSession({
        agentId: 'worker-a',
        role: 'implementer',
        ownerId: 'user-1',
        projectId: 'proj-x',
        budget: { maxTokens: 1000, maxCommands: 5 }
      });

      consoleService.transitionStage(session.sessionId, 'implementation', 'file_system');
      expect(session.currentStage).toBe('implementation');

      consoleService.recordUsage(session.sessionId, { tokens: 300, commands: 2 });
      expect(session.resourceUsage.tokensUsed).toBe(300);

      const summary = consoleService.getConsoleSummary('proj-x');
      expect(summary.activeSessionCount).toBe(1);
      expect(summary.totalTokensUsed).toBe(300);
    });

    it('cancels session when token budget is exceeded', () => {
      const consoleService = new AgentOperationsConsoleService();

      const session = consoleService.startSession({
        agentId: 'worker-b',
        role: 'implementer',
        ownerId: 'user-1',
        projectId: 'proj-y',
        budget: { maxTokens: 500 }
      });

      expect(() => {
        consoleService.recordUsage(session.sessionId, { tokens: 600 });
      }).toThrow('token budget exceeded');

      expect(session.state).toBe('cancelled');
    });

    it('performs emergency stopAll across active sessions', () => {
      const consoleService = new AgentOperationsConsoleService();

      consoleService.startSession({
        agentId: 'worker-1',
        role: 'implementer',
        ownerId: 'user-1',
        projectId: 'proj-z'
      });

      consoleService.startSession({
        agentId: 'worker-2',
        role: 'reviewer',
        ownerId: 'user-1',
        projectId: 'proj-z'
      });

      const stoppedCount = consoleService.stopAll('proj-z');
      expect(stoppedCount).toBe(2);

      const active = consoleService.listSessionsForProject('proj-z', true);
      expect(active).toHaveLength(0);
    });
  });

  describe('PX06-T08: AgentEvidenceBundleService', () => {
    it('creates an immutable evidence bundle with valid cryptographic signature', () => {
      const envelope = createTaskEnvelope({
        role: 'implementer',
        title: 'Auth Refactor',
        description: 'Update JWT authentication logic'
      });

      const bundle = AgentEvidenceBundleService.createBundle({
        taskId: envelope.taskId,
        sessionId: 'sess-123',
        agentId: 'agent-impl',
        taskEnvelope: envelope,
        sourceBaseline: { commitSha: 'a1b2c3d4' },
        filesRead: ['src/core/auth/jwt.ts'],
        filesChanged: ['src/core/auth/jwt.ts'],
        patches: [{ filePath: 'src/core/auth/jwt.ts', diffContent: '+ export function verify()' }],
        commandsRun: [{
          command: 'npm test',
          exitCode: 0,
          stdout: 'PASS with token sk-1234567890abcdef12345678',
          stderr: '',
          durationMs: 120,
          timestamp: new Date().toISOString()
        }],
        resourceSummary: {
          tokensUsed: 1200,
          durationMs: 4500,
          commandsCount: 1,
          diskBytesUsed: 1024,
          estimatedCostUsd: 0.02
        },
        finalStatus: 'succeeded',
        handoffSummary: 'Completed JWT authentication update with passing unit tests.'
      });

      expect(bundle.bundleDigest).toHaveLength(64);
      expect(bundle.commandsRun[0].stdout).not.toContain('sk-1234567890');
      expect(AgentEvidenceBundleService.verifyBundle(bundle)).toBe(true);

      // Tampering test
      const tampered = { ...bundle, handoffSummary: 'Tampered summary' };
      expect(AgentEvidenceBundleService.verifyBundle(tampered)).toBe(false);
    });
  });
});
