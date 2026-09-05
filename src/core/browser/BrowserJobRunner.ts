/**
 * Browser Job Runner & Execution Orchestrator (CF-06)
 *
 * Executes AuthorizedBrowserJob instances within isolated sandboxes,
 * validating origin allowlists, requiring state-changing action approval digests,
 * collecting redacted QA evidence, and handling cancellation / cleanup.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  AuthorizedBrowserJob,
  BrowserJobAction,
  BrowserJobStatus,
  BrowserSecurityError,
  OriginNotAllowedError,
  StateChangingApprovalRequiredError,
  isOriginAllowed,
  isStateChangingAction,
  verifyBrowserJobIntegrity,
  computeActionApprovalDigest
} from './AuthorizedBrowserJob';
import { BrowserJobSandbox } from './BrowserJobSandbox';
import { BrowserEvidenceCollector } from './BrowserEvidenceCollector';
import { PlaywrightBrowserDriver } from './PlaywrightBrowserDriver';

export { PlaywrightBrowserDriver };

export interface BrowserDriver {
  navigate(url: string): Promise<{ url: string; title: string; content?: string; redirectCount?: number; responseSizeBytes?: number }>;
  click(selector: string, timeoutMs?: number): Promise<void>;
  type(selector: string, text: string, timeoutMs?: number): Promise<void>;
  scroll(direction?: string): Promise<void>;
  wait(ms: number): Promise<void>;
  screenshot(targetPath: string, fullPage?: boolean): Promise<string>;
  extractDom(selector?: string): Promise<string>;
  extractText(selector?: string): Promise<string>;
  submitForm(selector: string): Promise<void>;
  uploadFile(selector: string, filePaths: string[]): Promise<void>;
  evaluate<T = any>(script: string): Promise<T>;
  close(): Promise<void>;
}

export class MockBrowserDriver implements BrowserDriver {
  private currentUrl = 'about:blank';
  private pageContent = '<html><body><h1>Ready</h1></body></html>';

  async navigate(url: string): Promise<{ url: string; title: string; content?: string }> {
    this.currentUrl = url;
    this.pageContent = `<html><head><title>Test Page</title></head><body><h1>${url}</h1><p>Mock Content</p></body></html>`;
    return { url: this.currentUrl, title: 'Test Page', content: this.pageContent };
  }

  async click(selector: string): Promise<void> {}
  async type(selector: string, text: string): Promise<void> {}
  async scroll(direction?: string): Promise<void> {}
  async wait(ms: number): Promise<void> {
    await new Promise(r => setTimeout(r, Math.min(ms, 50)));
  }

  async screenshot(targetPath: string): Promise<string> {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(targetPath, Buffer.from('FAKE_PNG_BINARY'));
    return targetPath;
  }

  async extractDom(selector?: string): Promise<string> {
    return this.pageContent;
  }

  async extractText(selector?: string): Promise<string> {
    return 'Mock Content';
  }

  async submitForm(selector: string): Promise<void> {}
  async uploadFile(selector: string, filePaths: string[]): Promise<void> {}
  async evaluate<T = any>(script: string): Promise<T> {
    return null as any;
  }

  async close(): Promise<void> {}
}

/**
 * Concrete local browser driver backed by the project's Puppeteer runtime.
 * Tests must opt into MockBrowserDriver explicitly; production execution never
 * silently reports a mocked page as a successful browser run.
 */
export class PuppeteerBrowserDriver implements BrowserDriver {
  private browser: any;
  private page: any;

  constructor(private readonly profileDir: string, private readonly downloadDir: string) {}

  private async ensurePage(): Promise<any> {
    if (this.page) return this.page;
    const puppeteer = await import('puppeteer');
    this.browser = await puppeteer.default.launch({
      headless: true,
      userDataDir: this.profileDir,
      args: ['--disable-dev-shm-usage']
    });
    this.page = await this.browser.newPage();
    const client = await this.page.createCDPSession();
    await client.send('Browser.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: this.downloadDir
    });
    return this.page;
  }

  async navigate(url: string): Promise<{ url: string; title: string; content?: string; redirectCount?: number; responseSizeBytes?: number }> {
    const page = await this.ensurePage();
    const response = await page.goto(url, { waitUntil: 'networkidle2' });
    const content = await page.content();
    return {
      url: page.url(),
      title: await page.title(),
      content,
      redirectCount: response?.request()?.redirectChain()?.length || 0,
      responseSizeBytes: Buffer.byteLength(content, 'utf8')
    };
  }

  async click(selector: string, timeoutMs = 30000): Promise<void> {
    const page = await this.ensurePage();
    await page.waitForSelector(selector, { timeout: timeoutMs });
    await page.click(selector);
  }
  async type(selector: string, text: string, timeoutMs = 30000): Promise<void> {
    const page = await this.ensurePage();
    await page.waitForSelector(selector, { timeout: timeoutMs });
    await page.type(selector, text);
  }
  async scroll(direction = 'down'): Promise<void> {
    const page = await this.ensurePage();
    await page.evaluate((dir: string) => dir === 'top' ? window.scrollTo(0, 0) : dir === 'bottom' ? window.scrollTo(0, document.body.scrollHeight) : window.scrollBy(0, 500), direction);
  }
  async wait(ms: number): Promise<void> { await new Promise(resolve => setTimeout(resolve, ms)); }
  async screenshot(targetPath: string, fullPage = false): Promise<string> {
    const page = await this.ensurePage();
    await page.screenshot({ path: targetPath, fullPage });
    return targetPath;
  }
  async extractDom(selector?: string): Promise<string> {
    const page = await this.ensurePage();
    return selector ? page.$eval(selector, (element: Element) => element.outerHTML) : page.content();
  }
  async extractText(selector?: string): Promise<string> {
    const page = await this.ensurePage();
    return page.$eval(selector || 'body', (element: Element) => element.textContent || '');
  }
  async submitForm(selector: string): Promise<void> { await this.click(selector); }
  async uploadFile(selector: string, filePaths: string[]): Promise<void> {
    const page = await this.ensurePage();
    const input = await page.$(selector);
    if (!input) throw new BrowserSecurityError(`Upload input '${selector}' was not found.`);
    await input.uploadFile(...filePaths);
  }
  async evaluate<T = any>(script: string): Promise<T> {
    const page = await this.ensurePage();
    return page.evaluate((source: string) => (0, eval)(source), script);
  }
  async close(): Promise<void> {
    if (this.browser) await this.browser.close();
    this.browser = undefined;
    this.page = undefined;
  }
}

export class BrowserJobRunner {
  private activeJobs = new Map<string, {
    job: AuthorizedBrowserJob;
    sandbox: BrowserJobSandbox;
    collector: BrowserEvidenceCollector;
    driver: BrowserDriver;
    cancelled: boolean;
    abortController?: AbortController;
  }>();

  /**
   * Run an authorized browser job
   */
  public async executeJob(
    job: AuthorizedBrowserJob,
    driver?: BrowserDriver
  ): Promise<AuthorizedBrowserJob> {
    // 1. Verify integrity
    if (!verifyBrowserJobIntegrity(job)) {
      job.status = 'failed';
      job.error = 'Cryptographic job digest mismatch. Contract may have been tampered with.';
      throw new BrowserSecurityError(job.error);
    }

    // 2. Check expiration
    if (new Date(job.expiresAt).getTime() <= Date.now()) {
      job.status = 'failed';
      job.error = 'AuthorizedBrowserJob has expired.';
      throw new BrowserSecurityError(job.error);
    }

    // 3. Initialize Sandbox and Collector
    const sandbox = new BrowserJobSandbox(job.jobId, {
      maxDownloadBytes: job.budget.maxDownloadBytes
    });
    const paths = await sandbox.initialize();
    const collector = new BrowserEvidenceCollector(job.jobId);
    const browserDriver = driver || new PuppeteerBrowserDriver(paths.profileDir, paths.downloadDir);

    const activeEntry = {
      job,
      sandbox,
      collector,
      driver: browserDriver,
      cancelled: false
    };
    this.activeJobs.set(job.jobId, activeEntry);

    job.status = 'running';
    const startTime = Date.now();

    try {
      for (let i = job.currentActionIndex; i < job.actions.length; i++) {
        if (activeEntry.cancelled) {
          job.status = 'cancelled';
          break;
        }

        // Budget check: max duration
        if (Date.now() - startTime > job.budget.maxDurationMs) {
          throw new BrowserSecurityError(`Job exceeded maxDurationMs budget of ${job.budget.maxDurationMs}ms`);
        }

        // Budget check: max actions
        if (i >= job.budget.maxActions) {
          throw new BrowserSecurityError(`Job exceeded maxActions limit of ${job.budget.maxActions}`);
        }

        const action = job.actions[i];
        job.currentActionIndex = i;

        // Origin allowlist check on navigate actions
        if (action.type === 'navigate' && action.target) {
          if (!isOriginAllowed(action.target, job.originAllowlist, job.allowedSchemes)) {
            const err = new OriginNotAllowedError(action.target, job.originAllowlist);
            collector.recordActionExecuted(action, 0, false, err.message);
            throw err;
          }
        }

        // State-changing action approval gate
        if (isStateChangingAction(action)) {
          const approval = job.approvals[action.id];
          if (!approval) {
            job.status = 'awaiting_approval';
            const approvalError = new StateChangingApprovalRequiredError(action.id, action.type);
            collector.recordActionExecuted(action, 0, false, approvalError.message);
            throw approvalError;
          }

          // Verify approval digest
          const expectedDigest = computeActionApprovalDigest(job.jobId, action, approval.approvedBy);
          if (approval.approvalDigest !== expectedDigest) {
            job.status = 'failed';
            const digestError = new BrowserSecurityError(`Approval digest mismatch for state-changing action '${action.id}'.`);
            collector.recordActionExecuted(action, 0, false, digestError.message);
            throw digestError;
          }
        }

        // Execute action
        const actionStart = Date.now();
        let actionSuccess = true;
        let actionError: string | undefined;

        try {
          await this.executeAction(job, action, browserDriver, paths, collector);
        } catch (err: any) {
          actionSuccess = false;
          actionError = err.message || String(err);
          throw err;
        } finally {
          const duration = Date.now() - actionStart;
          collector.recordActionExecuted(action, duration, actionSuccess, actionError);
        }
      }

      if (job.status === 'running') {
        job.status = 'completed';
      }
    } catch (err: any) {
      if (job.status !== 'awaiting_approval' && job.status !== 'cancelled') {
        job.status = 'failed';
      }
      job.error = err.message || String(err);
      throw err;
    } finally {
      job.evidence = collector.getEvidence();
      await browserDriver.close();
      await sandbox.cleanup();
      this.activeJobs.delete(job.jobId);
    }

    return job;
  }

  private async executeAction(
    job: AuthorizedBrowserJob,
    action: BrowserJobAction,
    driver: BrowserDriver,
    paths: { screenshotsDir: string; downloadDir: string },
    collector: BrowserEvidenceCollector
  ): Promise<void> {
    switch (action.type) {
      case 'navigate': {
        const pageInfo = await driver.navigate(action.target!);
        if (!isOriginAllowed(pageInfo.url, job.originAllowlist, job.allowedSchemes)) {
          throw new OriginNotAllowedError(pageInfo.url, job.originAllowlist);
        }
        if ((pageInfo.redirectCount || 0) > job.budget.maxRedirects) {
          throw new BrowserSecurityError(`Navigation exceeded maxRedirects budget of ${job.budget.maxRedirects}`);
        }
        const responseSize = pageInfo.responseSizeBytes ?? (pageInfo.content ? Buffer.byteLength(pageInfo.content, 'utf8') : 0);
        if (responseSize > job.budget.maxResponseSizeBytes) {
          throw new BrowserSecurityError(`Navigation response exceeded maxResponseSizeBytes budget of ${job.budget.maxResponseSizeBytes}`);
        }
        collector.recordNetworkEvent({
          method: 'GET',
          url: action.target!,
          status: 200,
          headers: { 'content-type': 'text/html' },
          responseSize
        });
        if (pageInfo.content) {
          collector.recordDomSnapshot(action.target!, pageInfo.content);
        }
        break;
      }
      case 'click': {
        await driver.click(action.target!, action.timeoutMs);
        break;
      }
      case 'type': {
        await driver.type(action.target!, action.value || '', action.timeoutMs);
        break;
      }
      case 'scroll': {
        await driver.scroll(action.value);
        break;
      }
      case 'wait': {
        const ms = action.timeoutMs ?? parseInt(action.value || '1000', 10);
        await driver.wait(ms);
        break;
      }
      case 'screenshot': {
        const shotPath = path.join(paths.screenshotsDir, `shot_${action.id}_${Date.now()}.png`);
        const saved = await driver.screenshot(shotPath, action.value === 'full');
        collector.recordScreenshot(saved, action.id);
        break;
      }
      case 'extract_dom': {
        const dom = await driver.extractDom(action.target);
        collector.recordDomSnapshot(action.target || 'current_page', dom);
        break;
      }
      case 'extract_text': {
        await driver.extractText(action.target);
        break;
      }
      case 'submit_form': {
        await driver.submitForm(action.target!);
        collector.recordNetworkEvent({
          method: 'POST',
          url: action.target || 'form_submission',
          status: 200,
          headers: { 'content-type': 'application/x-www-form-urlencoded' }
        });
        break;
      }
      case 'upload_file': {
        await driver.uploadFile(action.target!, action.files || []);
        break;
      }
      case 'account_mutation': {
        await driver.evaluate(action.value || '');
        break;
      }
      case 'custom_eval': {
        await driver.evaluate(action.value || '');
        break;
      }
      default:
        throw new BrowserSecurityError(`Unsupported action type '${(action as any).type}'`);
    }
  }

  /**
   * Cancel an active browser job and trigger immediate cleanup
   */
  public async cancelJob(jobId: string, reason?: string): Promise<boolean> {
    const entry = this.activeJobs.get(jobId);
    if (!entry) {
      return false;
    }

    entry.cancelled = true;
    entry.job.status = 'cancelled';
    entry.job.error = reason || 'Cancelled by operator';

    try {
      await entry.driver.close();
      await entry.sandbox.cleanup();
    } catch {
      // ignore
    }

    this.activeJobs.delete(jobId);
    return true;
  }

  /**
   * Approve a state-changing action with a cryptographic digest
   */
  public approveAction(
    job: AuthorizedBrowserJob,
    actionId: string,
    approvedBy: string
  ): void {
    const action = job.actions.find(a => a.id === actionId);
    if (!action) {
      throw new BrowserSecurityError(`Action '${actionId}' not found in job '${job.jobId}'`);
    }

    const approvalDigest = computeActionApprovalDigest(job.jobId, action, approvedBy);
    job.approvals[actionId] = {
      actionId,
      approvedBy,
      approvalDigest,
      approvedAt: new Date().toISOString()
    };
  }
}
