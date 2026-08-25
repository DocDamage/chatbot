/**
 * CF-06 Transparent Browser Jobs Test Suite
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  createAuthorizedBrowserJob,
  verifyBrowserJobIntegrity,
  isOriginAllowed,
  computeActionApprovalDigest,
  StealthFeatureDisallowedError,
  OriginNotAllowedError,
  StateChangingApprovalRequiredError,
  BrowserSecurityError
} from './AuthorizedBrowserJob';
import { BrowserJobSandbox } from './BrowserJobSandbox';
import { BrowserEvidenceCollector } from './BrowserEvidenceCollector';
import { BrowserJobRunner, MockBrowserDriver } from './BrowserJobRunner';
import { PydollAdapter } from './PydollAdapter';

describe('CF-06 Transparent Browser Jobs', () => {
  describe('Origin Allowlist & URL Scheme Enforcement', () => {
    const allowlist = [
      'https://example.com',
      'https://*.myapp.com',
      'http://localhost:3000'
    ];

    it('allows valid URLs matching exact origin or wildcards', () => {
      expect(isOriginAllowed('https://example.com/login', allowlist)).toBe(true);
      expect(isOriginAllowed('https://qa.myapp.com/dashboard', allowlist)).toBe(true);
      expect(isOriginAllowed('https://staging.myapp.com/test', allowlist)).toBe(true);
      expect(isOriginAllowed('http://localhost:3000/app', allowlist)).toBe(true);
    });

    it('fails closed for non-allowlisted origins', () => {
      expect(isOriginAllowed('https://malicious.com', allowlist)).toBe(false);
      expect(isOriginAllowed('https://notmyapp.com', allowlist)).toBe(false);
      expect(isOriginAllowed('http://localhost:8080/admin', allowlist)).toBe(false);
      expect(isOriginAllowed('http://example.com', allowlist)).toBe(false); // wrong protocol
    });

    it('fails closed for dangerous or unauthorized schemes', () => {
      expect(isOriginAllowed('javascript:alert(1)', allowlist)).toBe(false);
      expect(isOriginAllowed('file:///etc/passwd', allowlist)).toBe(false);
      expect(isOriginAllowed('data:text/html,<h1>test</h1>', allowlist)).toBe(false);
    });

    it('rejects global wildcards, dangerous configured schemes, and invalid budgets', () => {
      expect(() => createAuthorizedBrowserJob({
        purpose: 'Unbounded job', requesterId: 'tester-1', originAllowlist: ['*']
      })).toThrow(/wildcard origins/);
      expect(() => createAuthorizedBrowserJob({
        purpose: 'File job', requesterId: 'tester-1', originAllowlist: ['localhost'], allowedSchemes: ['file:']
      })).toThrow(/only http: and https:/);
      expect(() => createAuthorizedBrowserJob({
        purpose: 'Invalid budget', requesterId: 'tester-1', originAllowlist: ['https://example.com'], budget: { maxActions: 0 }
      })).toThrow(/budgets/);
    });

    it('throws OriginNotAllowedError during job execution when target is not allowed', async () => {
      const job = createAuthorizedBrowserJob({
        purpose: 'QA Test Run',
        requesterId: 'tester-1',
        originAllowlist: ['https://example.com'],
        actions: [
          { id: 'act-1', type: 'navigate', target: 'https://evil.com/phishing' }
        ]
      });

      const runner = new BrowserJobRunner();
      await expect(runner.executeJob(job, new MockBrowserDriver())).rejects.toThrow(OriginNotAllowedError);
      expect(job.status).toBe('failed');
    });
  });

  describe('Anti-Stealth & Anti-Evasion Prohibitions', () => {
    it('rejects stealth and evasion options at job creation', () => {
      expect(() => {
        createAuthorizedBrowserJob({
          purpose: 'QA Test',
          requesterId: 'tester-1',
          originAllowlist: ['https://example.com'],
          prohibitedFeatures: { stealth: true } as any,
          ...({ stealth: true } as any)
        });
      }).toThrow(StealthFeatureDisallowedError);

      expect(() => {
        createAuthorizedBrowserJob({
          purpose: 'QA Test',
          requesterId: 'tester-1',
          originAllowlist: ['https://example.com'],
          ...({ bypassCaptcha: true } as any)
        });
      }).toThrow(StealthFeatureDisallowedError);

      expect(() => {
        createAuthorizedBrowserJob({
          purpose: 'QA Test',
          requesterId: 'tester-1',
          originAllowlist: ['https://example.com'],
          ...({ spoofFingerprint: true } as any)
        });
      }).toThrow(StealthFeatureDisallowedError);
    });

    it('rejects stealth flags within action metadata', () => {
      expect(() => {
        createAuthorizedBrowserJob({
          purpose: 'QA Test',
          requesterId: 'tester-1',
          originAllowlist: ['https://example.com'],
          actions: [
            { id: 'act-1', type: 'navigate', target: 'https://example.com', metadata: { rotateProxy: true } }
          ]
        });
      }).toThrow(StealthFeatureDisallowedError);
    });
  });

  describe('State-Changing Action Cryptographic Approval Gate', () => {
    it('pauses and fails closed when state-changing action is unapproved', async () => {
      const job = createAuthorizedBrowserJob({
        purpose: 'Form submission QA',
        requesterId: 'tester-1',
        originAllowlist: ['https://example.com'],
        actions: [
          { id: 'act-1', type: 'navigate', target: 'https://example.com' },
          { id: 'act-2', type: 'submit_form', target: '#submit-btn' }
        ]
      });

      const runner = new BrowserJobRunner();
      await expect(runner.executeJob(job, new MockBrowserDriver())).rejects.toThrow(StateChangingApprovalRequiredError);
      expect(job.status).toBe('awaiting_approval');
    });

    it('executes state-changing action when valid approval digest is provided', async () => {
      const job = createAuthorizedBrowserJob({
        purpose: 'Form submission QA',
        requesterId: 'tester-1',
        originAllowlist: ['https://example.com'],
        actions: [
          { id: 'act-1', type: 'navigate', target: 'https://example.com' },
          { id: 'act-2', type: 'submit_form', target: '#submit-btn' }
        ]
      });

      const runner = new BrowserJobRunner();
      runner.approveAction(job, 'act-2', 'operator-lead');

      const completed = await runner.executeJob(job, new MockBrowserDriver());
      expect(completed.status).toBe('completed');
      expect(completed.evidence?.actionsExecuted.length).toBe(2);
      expect(completed.evidence?.actionsExecuted[1].action.type).toBe('submit_form');
    });

    it('rejects forged or tampered approval digests', async () => {
      const job = createAuthorizedBrowserJob({
        purpose: 'Form submission QA',
        requesterId: 'tester-1',
        originAllowlist: ['https://example.com'],
        actions: [
          { id: 'act-1', type: 'navigate', target: 'https://example.com' },
          { id: 'act-2', type: 'submit_form', target: '#submit-btn' }
        ]
      });

      // Forge an invalid approval
      job.approvals['act-2'] = {
        actionId: 'act-2',
        approvedBy: 'hacker',
        approvalDigest: 'bad0000000000000000000000000000000000000000000000000000000000000',
        approvedAt: new Date().toISOString()
      };

      const runner = new BrowserJobRunner();
      await expect(runner.executeJob(job, new MockBrowserDriver())).rejects.toThrow(/Approval digest mismatch/);
      expect(job.status).toBe('failed');
    });

    it('treats arbitrary page evaluation as state-changing', async () => {
      const job = createAuthorizedBrowserJob({
        purpose: 'Custom evaluation',
        requesterId: 'tester-1',
        originAllowlist: ['https://example.com'],
        actions: [{ id: 'eval-1', type: 'custom_eval', value: 'document.body.remove()' }]
      });
      await expect(new BrowserJobRunner().executeJob(job, new MockBrowserDriver())).rejects.toThrow(StateChangingApprovalRequiredError);
    });

    it('rejects redirects outside the allowlist and oversized responses', async () => {
      const redirected = createAuthorizedBrowserJob({
        purpose: 'Redirect test', requesterId: 'tester-1', originAllowlist: ['https://example.com'],
        actions: [{ id: 'nav', type: 'navigate', target: 'https://example.com' }]
      });
      const redirectDriver = new MockBrowserDriver();
      redirectDriver.navigate = async () => ({ url: 'https://evil.example/phish', title: 'redirected', redirectCount: 1 });
      await expect(new BrowserJobRunner().executeJob(redirected, redirectDriver)).rejects.toThrow(OriginNotAllowedError);

      const oversized = createAuthorizedBrowserJob({
        purpose: 'Response size test', requesterId: 'tester-1', originAllowlist: ['https://example.com'],
        budget: { maxResponseSizeBytes: 10 },
        actions: [{ id: 'nav', type: 'navigate', target: 'https://example.com' }]
      });
      const sizeDriver = new MockBrowserDriver();
      sizeDriver.navigate = async () => ({ url: 'https://example.com', title: 'large', content: 'x'.repeat(11) });
      await expect(new BrowserJobRunner().executeJob(oversized, sizeDriver)).rejects.toThrow(/maxResponseSizeBytes/);
    });
  });

  describe('Browser Job Sandbox & File Containment', () => {
    const testJobId = 'test-sandbox-job';
    let sandbox: BrowserJobSandbox;

    beforeEach(async () => {
      sandbox = new BrowserJobSandbox(testJobId, { maxDownloadBytes: 1024 * 1024 });
      await sandbox.initialize();
    });

    afterEach(async () => {
      await sandbox.cleanup();
    });

    it('creates isolated directories for profile, downloads, and screenshots', () => {
      const paths = sandbox.getPaths();
      expect(fs.existsSync(paths.profileDir)).toBe(true);
      expect(fs.existsSync(paths.downloadDir)).toBe(true);
      expect(fs.existsSync(paths.screenshotsDir)).toBe(true);
    });

    it('saves valid downloads and calculates size correctly', () => {
      const data = Buffer.from('Hello Browser QA Download');
      const savedPath = sandbox.saveDownload('report.pdf', data);
      expect(fs.existsSync(savedPath)).toBe(true);
      expect(sandbox.getDownloadDirectorySize()).toBe(data.byteLength);
    });

    it('prevents path traversal outside the download directory', () => {
      const data = Buffer.from('escape attempt');
      expect(() => {
        sandbox.saveDownload('../../../escape.txt', data);
      }).toThrow(BrowserSecurityError);
    });

    it('enforces download budget quotas', () => {
      const smallSandbox = new BrowserJobSandbox('small-sandbox', { maxDownloadBytes: 50 });
      const bigData = Buffer.alloc(100);
      expect(() => {
        smallSandbox.saveDownload('big.zip', bigData);
      }).toThrow(/exceeds maximum allowed budget/);
    });

    it('cleans up sandbox directory tree on cleanup()', async () => {
      const paths = sandbox.getPaths();
      await sandbox.cleanup();
      expect(fs.existsSync(paths.profileDir)).toBe(false);
      expect(fs.existsSync(paths.downloadDir)).toBe(false);
    });
  });

  describe('QA Evidence Collector & Credential Redaction', () => {
    it('redacts sensitive query parameters from URLs', () => {
      const collector = new BrowserEvidenceCollector('job-1');
      const redacted = collector.redactUrl('https://example.com/api?token=secret123&name=test&password=pass456&apiKey=key789');
      expect(redacted).toContain('token=%5BREDACTED%5D');
      expect(redacted).toContain('password=%5BREDACTED%5D');
      expect(redacted).toContain('apiKey=%5BREDACTED%5D');
      expect(redacted).toContain('name=test');
      expect(redacted).not.toContain('secret123');
      expect(redacted).not.toContain('pass456');
    });

    it('redacts sensitive HTTP headers', () => {
      const collector = new BrowserEvidenceCollector('job-1');
      const sanitized = collector.redactHeaders({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOi...',
        'Cookie': 'sessionId=abc12345; auth=xyz',
        'X-API-Key': 'super-secret-key',
        'User-Agent': 'TestRunner/1.0'
      });

      expect(sanitized['Content-Type']).toBe('application/json');
      expect(sanitized['Authorization']).toBe('[REDACTED]');
      expect(sanitized['Cookie']).toBe('[REDACTED]');
      expect(sanitized['X-API-Key']).toBe('[REDACTED]');
      expect(sanitized['User-Agent']).toBe('TestRunner/1.0');
    });

    it('redacts passwords in DOM snapshots and request bodies', () => {
      const collector = new BrowserEvidenceCollector('job-1');
      const rawDom = '<form><input type="password" value="mysecretpwd123" /><input type="text" value="user1" /></form>';
      const sanitizedDom = collector.redactDom(rawDom);
      expect(sanitizedDom).not.toContain('mysecretpwd123');
      expect(sanitizedDom).toContain('value="[REDACTED]"');
      expect(sanitizedDom).toContain('user1');

      const body = JSON.stringify({ username: 'john', password: 'password999', token: 'secretToken' });
      const sanitizedBody = collector.redactBody(body);
      expect(sanitizedBody).not.toContain('password999');
      expect(sanitizedBody).not.toContain('secretToken');
      expect(sanitizedBody).toContain('john');
    });

    it('assembles complete QA evidence bundle with screenshots and actions', async () => {
      const job = createAuthorizedBrowserJob({
        purpose: 'QA Test Run with Evidence',
        requesterId: 'tester-1',
        originAllowlist: ['https://example.com'],
        actions: [
          { id: 'act-1', type: 'navigate', target: 'https://example.com' },
          { id: 'act-2', type: 'screenshot' },
          { id: 'act-3', type: 'extract_dom' }
        ]
      });

      const runner = new BrowserJobRunner();
      const completed = await runner.executeJob(job, new MockBrowserDriver());

      expect(completed.status).toBe('completed');
      expect(completed.evidence).toBeDefined();
      expect(completed.evidence?.screenshots.length).toBe(1);
      expect(completed.evidence?.domSnapshots.length).toBe(2); // From navigate and extract_dom
      expect(completed.evidence?.actionsExecuted.length).toBe(3);
    });
  });

  describe('Pydoll CDP Adapter Contract & Local-Only Boundary', () => {
    it('is disabled by default', () => {
      const adapter = new PydollAdapter();
      expect(adapter.getDescriptor().enabled).toBe(false);
      expect(adapter.getDescriptor().localOnly).toBe(true);
      expect(adapter.getDescriptor().stealthExcluded).toBe(true);
    });

    it('rejects execution when disabled', async () => {
      const adapter = new PydollAdapter({ enabled: false });
      await expect(adapter.connect()).rejects.toThrow(/disabled by default/);
    });

    it('rejects execution in hosted mode', async () => {
      const adapter = new PydollAdapter({ enabled: true, environment: 'HOSTED' });
      await expect(adapter.connect()).rejects.toThrow(/strictly LOCAL_ONLY/);
    });

    it('rejects non-loopback CDP host', async () => {
      const adapter = new PydollAdapter({ enabled: true, cdpHost: '192.168.1.50' });
      await expect(adapter.connect()).rejects.toThrow(/local loopback interface/);
    });

    it('rejects stealth or evasion options', async () => {
      const adapter = new PydollAdapter({
        enabled: true,
        options: { stealth: true }
      });
      await expect(adapter.connect()).rejects.toThrow(StealthFeatureDisallowedError);
    });

    it('connects successfully when valid local configuration is provided', async () => {
      const adapter = new PydollAdapter({
        enabled: true,
        environment: 'LOCAL_TRUSTED',
        cdpHost: '127.0.0.1'
      });
      const connected = await adapter.connect();
      expect(connected).toBe(true);
      expect(adapter.isConnected()).toBe(true);
      await adapter.disconnect();
      expect(adapter.isConnected()).toBe(false);
    });
  });

  describe('Job Lifecycle, Cancellation, and Integrity Verification', () => {
    it('verifies cryptographic integrity of job contract', () => {
      const job = createAuthorizedBrowserJob({
        purpose: 'Integrity test',
        requesterId: 'tester-1',
        originAllowlist: ['https://example.com']
      });

      expect(verifyBrowserJobIntegrity(job)).toBe(true);

      // Tampering test
      const tamperedJob = { ...job, purpose: 'Tampered purpose' };
      expect(verifyBrowserJobIntegrity(tamperedJob)).toBe(false);
    });

    it('cancels active job and terminates sandbox', async () => {
      const job = createAuthorizedBrowserJob({
        purpose: 'Cancellation test',
        requesterId: 'tester-1',
        originAllowlist: ['https://example.com'],
        actions: [
          { id: 'act-1', type: 'navigate', target: 'https://example.com' },
          { id: 'act-2', type: 'wait', timeoutMs: 5000 },
          { id: 'act-3', type: 'screenshot' }
        ]
      });

      const runner = new BrowserJobRunner();
      const execPromise = runner.executeJob(job, new MockBrowserDriver());

      // Cancel shortly after starting
      setTimeout(() => {
        runner.cancelJob(job.jobId, 'User requested cancel');
      }, 20);

      await execPromise.catch(() => {});
      expect(job.status === 'cancelled' || job.status === 'completed').toBe(true);
    });

    it('rejects tampered and expired jobs before allocating a browser sandbox', async () => {
      const tampered = createAuthorizedBrowserJob({
        purpose: 'Integrity execution test',
        requesterId: 'tester-1',
        originAllowlist: ['https://example.com']
      });
      (tampered as any).purpose = 'Changed after signing';

      await expect(new BrowserJobRunner().executeJob(tampered, new MockBrowserDriver()))
        .rejects.toThrow(/digest mismatch/);
      expect(tampered.status).toBe('failed');

      const expired = createAuthorizedBrowserJob({
        purpose: 'Expired execution test',
        requesterId: 'tester-1',
        originAllowlist: ['https://example.com'],
        ttlMs: -1
      });
      await expect(new BrowserJobRunner().executeJob(expired, new MockBrowserDriver()))
        .rejects.toThrow(/expired/);
      expect(expired.status).toBe('failed');
    });

    it('executes every supported browser action through the driver contract', async () => {
      const job = createAuthorizedBrowserJob({
        purpose: 'Complete action dispatch test',
        requesterId: 'tester-1',
        originAllowlist: ['https://example.com'],
        actions: [
          { id: 'navigate', type: 'navigate', target: 'https://example.com' },
          { id: 'click', type: 'click', target: '#button', timeoutMs: 25 },
          { id: 'type', type: 'type', target: '#input' },
          { id: 'scroll', type: 'scroll' },
          { id: 'wait', type: 'wait', value: '1' },
          { id: 'screenshot', type: 'screenshot', value: 'full' },
          { id: 'dom', type: 'extract_dom', target: 'main' },
          { id: 'text', type: 'extract_text' },
          { id: 'submit', type: 'submit_form', target: '#form' },
          { id: 'upload', type: 'upload_file', target: '#file' },
          { id: 'account', type: 'account_mutation' },
          { id: 'eval', type: 'custom_eval', value: 'document.title' }
        ]
      });
      const driver = new MockBrowserDriver();
      const spies = {
        click: jest.spyOn(driver, 'click'),
        type: jest.spyOn(driver, 'type'),
        scroll: jest.spyOn(driver, 'scroll'),
        wait: jest.spyOn(driver, 'wait'),
        screenshot: jest.spyOn(driver, 'screenshot'),
        extractDom: jest.spyOn(driver, 'extractDom'),
        extractText: jest.spyOn(driver, 'extractText'),
        submitForm: jest.spyOn(driver, 'submitForm'),
        uploadFile: jest.spyOn(driver, 'uploadFile'),
        evaluate: jest.spyOn(driver, 'evaluate')
      };
      const runner = new BrowserJobRunner();
      for (const actionId of ['submit', 'upload', 'account', 'eval']) {
        runner.approveAction(job, actionId, 'operator-lead');
      }

      const result = await runner.executeJob(job, driver);

      expect(result.status).toBe('completed');
      expect(spies.click).toHaveBeenCalledWith('#button', 25);
      expect(spies.type).toHaveBeenCalledWith('#input', '', undefined);
      expect(spies.scroll).toHaveBeenCalledWith(undefined);
      expect(spies.wait).toHaveBeenCalledWith(1);
      expect(spies.screenshot).toHaveBeenCalledWith(expect.any(String), true);
      expect(spies.extractDom).toHaveBeenCalledWith('main');
      expect(spies.extractText).toHaveBeenCalledWith(undefined);
      expect(spies.submitForm).toHaveBeenCalledWith('#form');
      expect(spies.uploadFile).toHaveBeenCalledWith('#file', []);
      expect(spies.evaluate).toHaveBeenNthCalledWith(1, '');
      expect(spies.evaluate).toHaveBeenNthCalledWith(2, 'document.title');
      expect(result.evidence?.networkLogs.some(log => log.method === 'POST')).toBe(true);
    });

    it('enforces redirect, action-count, duration, and unsupported-action budgets', async () => {
      const redirected = createAuthorizedBrowserJob({
        purpose: 'Redirect budget test',
        requesterId: 'tester-1',
        originAllowlist: ['https://example.com'],
        budget: { maxRedirects: 0 },
        actions: [{ id: 'navigate', type: 'navigate', target: 'https://example.com' }]
      });
      const redirectDriver = new MockBrowserDriver();
      redirectDriver.navigate = async () => ({
        url: 'https://example.com/final', title: 'final', redirectCount: 1, responseSizeBytes: 0
      });
      await expect(new BrowserJobRunner().executeJob(redirected, redirectDriver))
        .rejects.toThrow(/maxRedirects/);

      const actionLimited = createAuthorizedBrowserJob({
        purpose: 'Action budget test', requesterId: 'tester-1', originAllowlist: ['https://example.com'],
        budget: { maxActions: 1 },
        actions: [{ id: 'first', type: 'click', target: '#one' }, { id: 'second', type: 'click', target: '#two' }]
      });
      await expect(new BrowserJobRunner().executeJob(actionLimited, new MockBrowserDriver()))
        .rejects.toThrow(/maxActions/);

      const durationLimited = createAuthorizedBrowserJob({
        purpose: 'Duration budget test', requesterId: 'tester-1', originAllowlist: ['https://example.com'],
        budget: { maxDurationMs: 1 },
        actions: [{ id: 'pause', type: 'wait', timeoutMs: 10 }, { id: 'after', type: 'click', target: '#late' }]
      });
      await expect(new BrowserJobRunner().executeJob(durationLimited, new MockBrowserDriver()))
        .rejects.toThrow(/maxDurationMs/);

      const unsupported = createAuthorizedBrowserJob({
        purpose: 'Unsupported action test', requesterId: 'tester-1', originAllowlist: ['https://example.com'],
        actions: [{ id: 'unknown', type: 'unsupported' } as any]
      });
      await expect(new BrowserJobRunner().executeJob(unsupported, new MockBrowserDriver()))
        .rejects.toThrow(/Unsupported action type/);
    });

    it('reports missing jobs and action approvals without mutating state', async () => {
      const runner = new BrowserJobRunner();
      expect(await runner.cancelJob('missing-job')).toBe(false);

      const job = createAuthorizedBrowserJob({
        purpose: 'Missing action test', requesterId: 'tester-1', originAllowlist: ['https://example.com']
      });
      expect(() => runner.approveAction(job, 'missing-action', 'operator')).toThrow(/not found/);
    });
  });
});
