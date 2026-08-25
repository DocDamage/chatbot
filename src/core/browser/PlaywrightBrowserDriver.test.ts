import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PlaywrightBrowserDriver } from './PlaywrightBrowserDriver';

jest.mock('playwright', () => ({
  chromium: { launchPersistentContext: jest.fn() }
}), { virtual: true });

const playwright = require('playwright') as {
  chromium: { launchPersistentContext: jest.Mock };
};

describe('PlaywrightBrowserDriver', () => {
  let root: string;
  let profileDir: string;
  let downloadDir: string;
  let page: Record<string, jest.Mock>;
  let context: {
    tracing: { start: jest.Mock; stop: jest.Mock };
    pages: jest.Mock;
    newPage: jest.Mock;
    close: jest.Mock;
  };

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-driver-test-'));
    profileDir = path.join(root, 'profile');
    downloadDir = path.join(root, 'downloads');
    page = {
      goto: jest.fn().mockResolvedValue({ headers: () => ({ 'content-length': '42' }) }),
      url: jest.fn().mockReturnValue('https://example.com/final'),
      title: jest.fn().mockResolvedValue('Fixture title'),
      content: jest.fn().mockResolvedValue('<main>fixture</main>'),
      click: jest.fn().mockResolvedValue(undefined),
      fill: jest.fn().mockResolvedValue(undefined),
      evaluate: jest.fn().mockResolvedValue('evaluated'),
      waitForTimeout: jest.fn().mockResolvedValue(undefined),
      screenshot: jest.fn().mockResolvedValue(undefined),
      $: jest.fn(),
      innerText: jest.fn().mockResolvedValue('body text'),
      setInputFiles: jest.fn().mockResolvedValue(undefined)
    };
    context = {
      tracing: { start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined) },
      pages: jest.fn().mockReturnValue([page]),
      newPage: jest.fn().mockResolvedValue(page),
      close: jest.fn().mockResolvedValue(undefined)
    };
    playwright.chromium.launchPersistentContext.mockReset().mockResolvedValue(context);
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it('creates persistent directories, tracing, video, and reuses the initialized page', async () => {
    const driver = new PlaywrightBrowserDriver({
      profileDir, downloadDir, recordTrace: true, recordVideo: true, headless: false, timeoutMs: 1234
    });
    const first = await driver.navigate('https://example.com');
    const second = await driver.navigate('https://example.com/again');

    expect(fs.existsSync(profileDir)).toBe(true);
    expect(fs.existsSync(downloadDir)).toBe(true);
    expect(playwright.chromium.launchPersistentContext).toHaveBeenCalledWith(profileDir, expect.objectContaining({
      headless: false,
      downloadsPath: downloadDir,
      recordVideo: { dir: path.join(downloadDir, 'videos') }
    }));
    expect(context.tracing.start).toHaveBeenCalledWith({ screenshots: true, snapshots: true, sources: true });
    expect(page.goto).toHaveBeenNthCalledWith(1, 'https://example.com', {
      waitUntil: 'domcontentloaded', timeout: 1234
    });
    expect(first).toMatchObject({
      url: 'https://example.com/final', title: 'Fixture title', responseSizeBytes: 42, redirectCount: 0
    });
    expect(second.responseSizeBytes).toBe(42);
    expect(playwright.chromium.launchPersistentContext).toHaveBeenCalledTimes(1);

    await driver.close();
    expect(context.tracing.stop).toHaveBeenCalledWith({ path: expect.stringMatching(/trace-\d+\.zip$/) });
    expect(context.close).toHaveBeenCalledTimes(1);
  });

  it('uses a new page, default launch options, and content size when headers are absent', async () => {
    context.pages.mockReturnValue([]);
    page.goto.mockResolvedValue(null);
    page.content.mockResolvedValue('content-size');
    const driver = new PlaywrightBrowserDriver({ profileDir, downloadDir });

    const result = await driver.navigate('https://example.com');

    expect(context.newPage).toHaveBeenCalledTimes(1);
    expect(playwright.chromium.launchPersistentContext).toHaveBeenCalledWith(profileDir, expect.objectContaining({
      headless: true, recordVideo: undefined
    }));
    expect(page.goto).toHaveBeenCalledWith('https://example.com', {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    expect(result.responseSizeBytes).toBe('content-size'.length);
    await driver.close();
  });

  it('wraps Playwright launch failures with a stable driver error', async () => {
    playwright.chromium.launchPersistentContext.mockRejectedValueOnce(new Error('browser missing'));
    const driver = new PlaywrightBrowserDriver({ profileDir, downloadDir });
    await expect(driver.navigate('https://example.com')).rejects.toThrow('Playwright driver launch failed: browser missing');
  });

  it('dispatches interaction, extraction, upload, and evaluation operations', async () => {
    const element = {
      innerHTML: jest.fn().mockResolvedValue('<span>inside</span>'),
      innerText: jest.fn().mockResolvedValue('inside text'),
      evaluate: jest.fn().mockResolvedValue(undefined)
    };
    page.$.mockResolvedValue(element);
    const driver = new PlaywrightBrowserDriver({ profileDir, downloadDir });

    await driver.click('#button');
    await driver.click('#button', 55);
    await driver.type('#input', 'value');
    await driver.type('#input', 'value', 66);
    await driver.scroll('up');
    await driver.scroll();
    await driver.wait(7);
    expect(await driver.extractDom('#main')).toBe('<span>inside</span>');
    expect(await driver.extractDom()).toBe('<main>fixture</main>');
    expect(await driver.extractText('#main')).toBe('inside text');
    expect(await driver.extractText()).toBe('body text');
    await driver.submitForm('#form');
    await driver.uploadFile('#file', ['fixture.txt']);
    await expect(driver.evaluate<string>('document.title')).resolves.toBe('evaluated');

    expect(page.click).toHaveBeenNthCalledWith(1, '#button', { timeout: 10000 });
    expect(page.click).toHaveBeenNthCalledWith(2, '#button', { timeout: 55 });
    expect(page.fill).toHaveBeenNthCalledWith(1, '#input', 'value', { timeout: 10000 });
    expect(page.fill).toHaveBeenNthCalledWith(2, '#input', 'value', { timeout: 66 });
    expect(page.evaluate).toHaveBeenCalledWith(expect.any(Function), -500);
    expect(page.evaluate).toHaveBeenCalledWith(expect.any(Function), 500);
    expect(page.waitForTimeout).toHaveBeenCalledWith(7);
    expect(element.evaluate).toHaveBeenCalledWith(expect.any(Function));
    expect(page.setInputFiles).toHaveBeenCalledWith('#file', ['fixture.txt']);
    await driver.close();
  });

  it('returns empty selector results, ignores a missing form, and creates screenshot parents', async () => {
    page.$.mockResolvedValue(null);
    const driver = new PlaywrightBrowserDriver({ profileDir, downloadDir });
    const screenshotPath = path.join(root, 'nested', 'shots', 'page.png');

    expect(await driver.extractDom('.missing')).toBe('');
    expect(await driver.extractText('.missing')).toBe('');
    await driver.submitForm('.missing');
    expect(await driver.screenshot(screenshotPath, true)).toBe(screenshotPath);
    expect(fs.existsSync(path.dirname(screenshotPath))).toBe(true);
    expect(page.screenshot).toHaveBeenCalledWith({ path: screenshotPath, fullPage: true });
    await driver.close();
  });

  it('tolerates trace-save and context-close failures and allows repeated close', async () => {
    context.tracing.stop.mockRejectedValueOnce(new Error('trace failure'));
    context.close.mockRejectedValueOnce(new Error('close failure'));
    const driver = new PlaywrightBrowserDriver({ profileDir, downloadDir, recordTrace: true });
    await driver.wait(1);
    await expect(driver.close()).resolves.toBeUndefined();
    await expect(driver.close()).resolves.toBeUndefined();
  });
});
