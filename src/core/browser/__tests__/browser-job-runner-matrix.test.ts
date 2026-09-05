import {
  createAuthorizedBrowserJob,
  computeActionApprovalDigest,
  OriginNotAllowedError,
  StateChangingApprovalRequiredError
} from '../AuthorizedBrowserJob';
import { BrowserJobRunner, MockBrowserDriver } from '../BrowserJobRunner';

describe('B75-08: Browser Job Runner and Authorized Job Execution Matrix', () => {
  let runner: BrowserJobRunner;

  beforeEach(() => {
    runner = new BrowserJobRunner();
  });

  describe('BrowserJobRunner Execution Flow', () => {
    it('executes allowed navigate, extract, and wait actions with MockBrowserDriver', async () => {
      const job = createAuthorizedBrowserJob({
        purpose: 'extract docs',
        requesterId: 'user_123',
        originAllowlist: ['example.com'],
        actions: [
          { id: 'act_1', type: 'navigate', target: 'https://example.com/docs' },
          { id: 'act_2', type: 'wait', value: '10' },
          { id: 'act_3', type: 'extract_dom' }
        ],
        budget: {
          maxDurationMs: 5000,
          maxActions: 10,
          maxRedirects: 3,
          maxResponseSizeBytes: 1024 * 1024,
          maxDownloadBytes: 1024 * 1024
        }
      });

      const driver = new MockBrowserDriver();
      const completed = await runner.executeJob(job, driver);
      expect(completed.status).toBe('completed');
    });

    it('rejects navigation to disallowed origin with OriginNotAllowedError', async () => {
      const job = createAuthorizedBrowserJob({
        purpose: 'unauthorized nav',
        requesterId: 'user_123',
        originAllowlist: ['example.com'],
        actions: [
          { id: 'act_1', type: 'navigate', target: 'https://malicious-site.com/steal' }
        ],
        budget: {
          maxDurationMs: 5000,
          maxActions: 5,
          maxRedirects: 3,
          maxResponseSizeBytes: 1024 * 1024,
          maxDownloadBytes: 1024 * 1024
        }
      });

      const driver = new MockBrowserDriver();
      await expect(runner.executeJob(job, driver)).rejects.toThrow(OriginNotAllowedError);
      expect(job.status).toBe('failed');
    });

    it('requires approval digest for state changing actions like form submit', async () => {
      const action = { id: 'act_submit', type: 'submit_form' as const, target: '#checkout-form' };
      const job = createAuthorizedBrowserJob({
        purpose: 'submit test',
        requesterId: 'user_123',
        originAllowlist: ['example.com'],
        actions: [
          { id: 'act_nav', type: 'navigate', target: 'https://example.com/form' },
          action
        ],
        budget: {
          maxDurationMs: 5000,
          maxActions: 5,
          maxRedirects: 3,
          maxResponseSizeBytes: 1024 * 1024,
          maxDownloadBytes: 1024 * 1024
        }
      });

      const driver = new MockBrowserDriver();
      await expect(runner.executeJob(job, driver)).rejects.toThrow(StateChangingApprovalRequiredError);
      expect(job.status).toBe('awaiting_approval');

      // Now attach approval
      const digest = computeActionApprovalDigest(job.jobId, job.actions[1], 'admin_user');
      job.approvals[action.id] = {
        actionId: action.id,
        approvedBy: 'admin_user',
        approvalDigest: digest,
        approvedAt: new Date().toISOString()
      };

      const success = await runner.executeJob(job, driver);
      expect(success.status).toBe('completed');
    });

    it('executes click, type, scroll, screenshot, extract_text, evaluate, and upload actions', async () => {
      const job = createAuthorizedBrowserJob({
        purpose: 'full action test',
        requesterId: 'user_123',
        originAllowlist: ['example.com'],
        actions: [
          { id: 'act_1', type: 'navigate', target: 'https://example.com/app' },
          { id: 'act_2', type: 'click', target: '#login-btn' },
          { id: 'act_3', type: 'type', target: '#user-input', value: 'hello' },
          { id: 'act_4', type: 'scroll', value: 'down' },
          { id: 'act_5', type: 'screenshot', value: 'full' },
          { id: 'act_6', type: 'extract_text', target: 'p' },
          { id: 'act_7', type: 'custom_eval', value: 'document.title' }
        ],
        budget: {
          maxDurationMs: 5000,
          maxActions: 10,
          maxRedirects: 3,
          maxResponseSizeBytes: 1024 * 1024,
          maxDownloadBytes: 1024 * 1024
        }
      });

      const driver = new MockBrowserDriver();
      const evalDigest = computeActionApprovalDigest(job.jobId, job.actions[6], 'admin_user');
      job.approvals['act_7'] = {
        actionId: 'act_7',
        approvedBy: 'admin_user',
        approvalDigest: evalDigest,
        approvedAt: new Date().toISOString()
      };

      const res = await runner.executeJob(job, driver);
      expect(res.status).toBe('completed');
      expect(res.evidence).toBeDefined();
    });

    it('rejects expired jobs and tampered contracts', async () => {
      const expiredJob = createAuthorizedBrowserJob({
        purpose: 'expired',
        requesterId: 'user_1',
        originAllowlist: ['example.com'],
        actions: [{ id: 'a1', type: 'wait', value: '1' }],
        budget: { maxDurationMs: 1000, maxActions: 1, maxRedirects: 1, maxResponseSizeBytes: 100, maxDownloadBytes: 100 }
      });
      (expiredJob as any).expiresAt = new Date(Date.now() - 10000).toISOString();

      const driver = new MockBrowserDriver();
      await expect(runner.executeJob(expiredJob, driver)).rejects.toThrow();

      // Tampered job
      const tamperedJob = createAuthorizedBrowserJob({
        purpose: 'tampered',
        requesterId: 'user_1',
        originAllowlist: ['example.com'],
        actions: [{ id: 'a1', type: 'wait', value: '1' }],
        budget: { maxDurationMs: 1000, maxActions: 1, maxRedirects: 1, maxResponseSizeBytes: 100, maxDownloadBytes: 100 }
      });
      (tamperedJob as any).originAllowlist = ['evil.com']; // violates digest
      await expect(runner.executeJob(tamperedJob, driver)).rejects.toThrow();
    });

    it('approves actions via approveAction method and executes upload_file and account_mutation', async () => {
      const job = createAuthorizedBrowserJob({
        purpose: 'upload and mutation',
        requesterId: 'user_1',
        originAllowlist: ['example.com'],
        actions: [
          { id: 'act_upload', type: 'upload_file', target: '#file-input', files: ['sample.txt'] },
          { id: 'act_mutate', type: 'account_mutation', value: 'deleteAccount()' }
        ],
        budget: { maxDurationMs: 5000, maxActions: 5, maxRedirects: 1, maxResponseSizeBytes: 1024, maxDownloadBytes: 1024 }
      });

      runner.approveAction(job, 'act_upload', 'admin_1');
      runner.approveAction(job, 'act_mutate', 'admin_1');

      const driver = new MockBrowserDriver();
      const res = await runner.executeJob(job, driver);
      expect(res.status).toBe('completed');
    });
  });
});
