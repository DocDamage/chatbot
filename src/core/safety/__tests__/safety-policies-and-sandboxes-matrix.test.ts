import { ApprovalPolicy } from '../ApprovalPolicy';
import { UncertaintyQuantifier } from '../UncertaintyQuantifier';
import { SandboxController } from '../SandboxController';
import { SelfCheckSafety } from '../SelfCheckSafety';
import * as path from 'path';

describe('B75-05: Safety Policies, Uncertainty, and Sandbox Decision Matrix', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ApprovalPolicy', () => {
    it('evaluates approval requirements across levels', () => {
      const policy = new ApprovalPolicy({ defaultLevel: 'on-request' });
      policy.setApprovalLevel('safe_read', 'never');
      policy.setApprovalLevel('risky_op', 'untrusted');
      policy.setApprovalLevel('retry_op', 'on-failure');

      expect(policy.needsApproval('safe_read')).toBe(false);
      expect(policy.needsApproval('risky_op')).toBe(true);
      expect(policy.needsApproval('retry_op', { failed: false })).toBe(false);
      expect(policy.needsApproval('retry_op', { failed: true })).toBe(true);
      expect(policy.needsApproval('unknown_op')).toBe(true);
    });

    it('auto-approves based on never level and autoApprovePatterns', async () => {
      const policy = new ApprovalPolicy({
        autoApprovePatterns: ['read_*', 'query_data'],
        autoDenyPatterns: ['drop_*', 'rm_critical'],
      });
      policy.setApprovalLevel('safe_static', 'never');

      expect(await policy.requestApproval('safe_static', 'Read static config')).toBe(true);
      expect(await policy.requestApproval('read_user_profile', 'Read user')).toBe(true);
      expect(await policy.requestApproval('query_data', 'Query metrics')).toBe(true);
      expect(await policy.requestApproval('drop_database', 'Drop DB')).toBe(false);
      expect(await policy.requestApproval('rm_critical', 'Remove critical')).toBe(false);
    });

    it('assesses risk levels and processes requests through handlers', async () => {
      const policy = new ApprovalPolicy();

      // Critical risk
      policy.registerHandler(async (req) => {
        expect(req.risk).toBe('critical');
        return true;
      });
      const criticalRes = await policy.requestApproval('delete_all_records', 'Purge DB', {});
      expect(criticalRes).toBe(true);

      // High risk
      const highPolicy = new ApprovalPolicy();
      highPolicy.registerHandler(async (req) => {
        expect(req.risk).toBe('high');
        return true;
      });
      await highPolicy.requestApproval('execute_script', 'Run script');

      // Medium risk
      const medPolicy = new ApprovalPolicy();
      medPolicy.registerHandler(async (req) => {
        expect(req.risk).toBe('medium');
        return false;
      });
      const medRes = await medPolicy.requestApproval('create_post', 'Create post');
      expect(medRes).toBe(false);

      // Low risk
      const lowPolicy = new ApprovalPolicy();
      lowPolicy.registerHandler(async (req) => {
        expect(req.risk).toBe('low');
        return true;
      });
      await lowPolicy.requestApproval('inspect_status', 'Inspect status');
    });

    it('handles manual approve, deny, pending requests, and stats', async () => {
      const policy = new ApprovalPolicy({ defaultLevel: 'on-request' });

      // Auto-denies when no handlers registered
      const noHandlerRes = await policy.requestApproval('custom_action', 'Test');
      expect(noHandlerRes).toBe(false);

      // Manual interaction with pending requests
      const testPolicy = new ApprovalPolicy();
      let pendingId = '';
      testPolicy.registerHandler(async (req) => {
        pendingId = req.id;
        // simulate async waiting
        return new Promise<boolean>((resolve) => {
          setTimeout(() => {
            const current = testPolicy.getPendingRequests().find((p) => p.id === req.id);
            resolve(current?.status === 'approved');
          }, 50);
        });
      });

      const reqPromise = testPolicy.requestApproval('async_action', 'Wait for manual approve');
      setTimeout(() => {
        expect(testPolicy.approve(pendingId)).toBe(true);
      }, 10);

      const approved = await reqPromise;
      expect(approved).toBe(true);

      const history = testPolicy.getHistory(5);
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].status).toBe('approved');

      const stats = testPolicy.getStats();
      expect(stats.approved).toBe(1);
      expect(testPolicy.deny('invalid_id')).toBe(false);
      expect(testPolicy.approve('invalid_id')).toBe(false);
    });
  });

  describe('UncertaintyQuantifier', () => {
    it('quantifies uncertainty with structured JSON response', async () => {
      const mockLLM = {
        generate: jest.fn().mockResolvedValue({
          content: JSON.stringify({
            confidence: 0.95,
            uncertainty: 0.05,
            factors: { knowledge: 0.9, certainty: 0.95, sourceQuality: 0.9 },
            explanation: 'High confidence from authoritative sources',
          }),
        }),
      };

      const quantifier = new UncertaintyQuantifier(mockLLM as any);
      const res = await quantifier.quantify('The capital of France is Paris.', true);

      expect(res.confidence).toBe(0.95);
      expect(res.uncertainty).toBe(0.05);
      expect(res.factors.knowledge).toBe(0.9);
      expect(res.explanation).toContain('authoritative sources');
    });

    it('quantifies uncertainty from plain text with qualifiers and keywords', async () => {
      const mockLLM = {
        generate: jest
          .fn()
          .mockResolvedValueOnce({ content: 'It might possibly rain tomorrow in Seattle.' })
          .mockResolvedValueOnce({ content: 'The sun definitely rises in the east.' }),
      };

      const quantifier = new UncertaintyQuantifier(mockLLM as any);
      const uncertainRes = await quantifier.quantify('Rain forecast');
      expect(uncertainRes.confidence).toBeLessThan(0.6);
      expect(uncertainRes.uncertainty).toBeGreaterThan(0.4);

      const certainRes = await quantifier.quantify('Sunrise direction');
      expect(certainRes.confidence).toBeGreaterThan(0.7);
    });

    it('falls back to safe default uncertainty when LLM throws', async () => {
      const mockLLM = {
        generate: jest.fn().mockRejectedValue(new Error('LLM Timeout')),
      };

      const quantifier = new UncertaintyQuantifier(mockLLM as any);
      const fallbackWithSources = await quantifier.quantify('Test with sources', true);
      expect(fallbackWithSources.confidence).toBe(0.5);
      expect(fallbackWithSources.factors.sourceQuality).toBe(0.7);

      const fallbackWithoutSources = await quantifier.quantify('Test without sources', false);
      expect(fallbackWithoutSources.factors.sourceQuality).toBe(0.3);
    });
  });

  describe('SandboxController', () => {
    const root = process.cwd();
    const testSandbox = new SandboxController({
      workspaceDir: root,
      allowedPaths: [root],
      blockedPaths: [path.join(root, 'blocked_dir')],
    });

    it('evaluates file access permissions based on mode and paths', () => {
      testSandbox.setMode('read-only');
      expect(testSandbox.getMode()).toBe('read-only');

      const readPerm = testSandbox.canAccessPath(path.join(root, 'src', 'index.ts'), 'read');
      expect(readPerm.allowed).toBe(true);

      const writePerm = testSandbox.canAccessPath(path.join(root, 'src', 'index.ts'), 'write');
      expect(writePerm.allowed).toBe(false);
      expect(writePerm.reason).toContain('read-only mode');

      testSandbox.setMode('workspace-write');
      const writeInside = testSandbox.canAccessPath(path.join(root, 'temp.txt'), 'write');
      expect(writeInside.allowed).toBe(true);

      const writeBlocked = testSandbox.canAccessPath(
        path.join(root, 'blocked_dir', 'secret.txt'),
        'write'
      );
      expect(writeBlocked.allowed).toBe(false);
      expect(writeBlocked.reason).toContain('blocked list');
    });

    it('evaluates command execution permissions across allow/block lists', () => {
      testSandbox.setMode('workspace-write');

      expect(testSandbox.canExecuteCommand('sudo rm -rf /').allowed).toBe(false);
      expect(testSandbox.canExecuteCommand('npm test').allowed).toBe(true);
      expect(testSandbox.canExecuteCommand('node -v').allowed).toBe(true);
      expect(testSandbox.canExecuteCommand('unknown_malicious_cmd').allowed).toBe(false);

      testSandbox.setMode('read-only');
      expect(testSandbox.canExecuteCommand('git status').allowed).toBe(true);
      expect(testSandbox.canExecuteCommand('npm install malicious').allowed).toBe(false);
    });

    it('rejects disallowed execution immediately with non-zero exit', async () => {
      const execRes = await testSandbox.execute('sudo format C:');
      expect(execRes.success).toBe(false);
      expect(execRes.exitCode).toBe(1);
    });
  });

  describe('SelfCheckSafety', () => {
    it('parses structured JSON safety checks', async () => {
      const mockLLM = {
        generate: jest.fn().mockResolvedValue({
          content: JSON.stringify({
            safe: true,
            confidence: 0.98,
            issues: [],
            reasoning: 'Clean educational text',
          }),
        }),
      };

      const safety = new SelfCheckSafety(mockLLM as any);
      const res = await safety.check('Photosynthesis converts light into chemical energy.');

      expect(res.safe).toBe(true);
      expect(res.confidence).toBe(0.98);
      expect(res.issues.length).toBe(0);
    });

    it('detects toxic and harmful content from text responses', async () => {
      const mockLLM = {
        generate: jest.fn().mockResolvedValue({
          content: 'This text is unsafe and harmful, with toxic content and privacy violations.',
        }),
      };

      const safety = new SelfCheckSafety(mockLLM as any);
      const res = await safety.check('Potentially harmful input');

      expect(res.safe).toBe(false);
      expect(res.issues).toContain('Potential toxic content');
      expect(res.issues).toContain('Potential privacy violation');
    });

    it('fails closed when LLM safety evaluation fails', async () => {
      const mockLLM = {
        generate: jest.fn().mockRejectedValue(new Error('Safety evaluator down')),
      };

      const safety = new SelfCheckSafety(mockLLM as any);
      const res = await safety.check('Some content');

      expect(res.safe).toBe(false);
      expect(res.issues).toContain('Safety check failed - manual review required');
    });
  });
});
