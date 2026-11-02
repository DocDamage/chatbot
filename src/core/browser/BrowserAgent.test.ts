import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BrowserAgent } from './BrowserAgent';

const mockLaunch = jest.fn();
const mockConnect = jest.fn();

jest.mock('puppeteer', () => ({
  __esModule: true,
  default: { launch: mockLaunch, connect: mockConnect }
}));

describe('BrowserAgent', () => {
  let root: string;
  let screenshotDir: string;
  let page: Record<string, jest.Mock>;
  let browser: { newPage: jest.Mock; pages: jest.Mock; close: jest.Mock };

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-agent-test-'));
    screenshotDir = path.join(root, 'screenshots');
    page = {
      setViewport: jest.fn().mockResolvedValue(undefined),
      setUserAgent: jest.fn().mockResolvedValue(undefined),
      goto: jest.fn().mockResolvedValue(undefined),
      url: jest.fn().mockReturnValue('https://example.com/current'),
      title: jest.fn().mockResolvedValue('Fixture page'),
      content: jest.fn().mockResolvedValue('<main>Fixture</main>'),
      screenshot: jest.fn().mockResolvedValue(undefined),
      waitForSelector: jest.fn().mockResolvedValue(undefined),
      click: jest.fn().mockResolvedValue(undefined),
      type: jest.fn().mockResolvedValue(undefined),
      evaluate: jest.fn().mockImplementation(async (fn: (...args: any[]) => any, arg?: any) => fn(arg)),
      $: jest.fn(),
      waitForNavigation: jest.fn().mockResolvedValue(undefined)
    };
    browser = {
      newPage: jest.fn().mockResolvedValue(page),
      pages: jest.fn().mockResolvedValue([page]),
      close: jest.fn().mockResolvedValue(undefined)
    };
    mockLaunch.mockReset().mockResolvedValue(browser);
    mockConnect.mockReset().mockResolvedValue(browser);
    (global as any).window = {
      scrollTo: jest.fn(),
      scrollBy: jest.fn()
    };
    (global as any).document = {
      body: { scrollHeight: 900, innerText: 'body fixture' },
      querySelectorAll: jest.fn().mockReturnValue([
        { href: 'https://example.com/a', textContent: ' Link A ' },
        { href: 'https://example.com/b', textContent: null }
      ])
    };
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    delete (global as any).window;
    delete (global as any).document;
    jest.restoreAllMocks();
  });

  it('launches with configured viewport and user agent, reports status, and closes', async () => {
    const agent = new BrowserAgent({
      headless: false, screenshotDir, userAgent: 'FixtureAgent/1.0', viewport: { width: 900, height: 600 }
    });
    expect(agent.isConnected()).toBe(false);
    expect(agent.getStatus()).toEqual({ connected: false, url: null, screenshotCount: 0 });

    await agent.launch();
    expect(mockLaunch).toHaveBeenCalledWith(expect.objectContaining({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    }));
    expect(page.setViewport).toHaveBeenCalledWith({ width: 900, height: 600 });
    expect(page.setUserAgent).toHaveBeenCalledWith('FixtureAgent/1.0');
    expect(agent.getStatus()).toEqual({
      connected: true, url: 'https://example.com/current', screenshotCount: 0
    });

    await agent.close();
    await agent.close();
    expect(browser.close).toHaveBeenCalledTimes(1);
    expect(agent.isConnected()).toBe(false);
  });

  it('launches with defaults and propagates launch failures', async () => {
    const agent = new BrowserAgent({ screenshotDir });
    await agent.launch();
    expect(page.setViewport).toHaveBeenCalledWith({ width: 1280, height: 720 });
    expect(page.setUserAgent).not.toHaveBeenCalled();
    await agent.close();

    mockLaunch.mockRejectedValueOnce(new Error('launch fixture'));
    await expect(new BrowserAgent({ screenshotDir }).launch()).rejects.toThrow('launch fixture');
  });

  it('connects through CDP using an existing page or creates one when absent', async () => {
    const first = new BrowserAgent({ screenshotDir });
    await first.connectCDP();
    expect(mockConnect).toHaveBeenCalledWith({
      browserURL: 'http://localhost:9222', defaultViewport: { width: 1280, height: 720 }
    });
    expect(browser.newPage).not.toHaveBeenCalled();
    await first.close();

    browser.pages.mockResolvedValueOnce([]);
    const second = new BrowserAgent({ screenshotDir });
    await second.connectCDP(9333);
    expect(mockConnect).toHaveBeenLastCalledWith({
      browserURL: 'http://localhost:9333', defaultViewport: { width: 1280, height: 720 }
    });
    expect(browser.newPage).toHaveBeenCalledTimes(1);
    await second.close();

    mockConnect.mockRejectedValueOnce(new Error('connect fixture'));
    await expect(new BrowserAgent({ screenshotDir }).connectCDP()).rejects.toThrow('connect fixture');
  });

  it('navigates, reports page information, and propagates navigation failures', async () => {
    const agent = new BrowserAgent({ screenshotDir, defaultTimeout: 123 });
    await agent.launch();
    await expect(agent.navigate('https://example.com')).resolves.toEqual({
      url: 'https://example.com/current', title: 'Fixture page', content: '<main>Fixture</main>'
    });
    expect(page.goto).toHaveBeenCalledWith('https://example.com', {
      waitUntil: 'networkidle2', timeout: 123
    });

    page.goto.mockRejectedValueOnce(new Error('navigation fixture'));
    await expect(agent.navigate('https://example.com/fail')).rejects.toThrow('navigation fixture');
    await agent.close();
  });

  it('captures screenshots and dispatches every supported action', async () => {
    const agent = new BrowserAgent({ screenshotDir });
    await agent.launch();
    const actions = [
      { type: 'click' as const, selector: '#button', timeout: 10 },
      { type: 'type' as const, selector: '#input', value: 'fixture', timeout: 11 },
      { type: 'scroll' as const, value: 'top' },
      { type: 'wait' as const, timeout: 1 },
      { type: 'screenshot' as const, value: 'full' },
      { type: 'navigate' as const, value: 'https://example.com/next' }
    ];
    const results = await agent.executeActions(actions);

    expect(results).toHaveLength(actions.length);
    expect(results.every(result => result.success)).toBe(true);
    expect(results[4].data).toMatch(/screenshot_\d+_1\.png$/);
    expect(results[5].data.url).toBe('https://example.com/current');
    expect(fs.existsSync(screenshotDir)).toBe(true);
    expect(page.screenshot).toHaveBeenCalledWith({ path: expect.any(String), fullPage: true });
    expect(agent.getStatus().screenshotCount).toBe(1);
    await agent.close();
  });

  it('stops action execution after a failure or unsupported action', async () => {
    const agent = new BrowserAgent({ screenshotDir });
    await agent.launch();
    page.click.mockRejectedValueOnce(new Error('click fixture'));
    const failed = await agent.executeActions([
      { type: 'click', selector: '#bad' },
      { type: 'navigate', value: 'https://example.com/never' }
    ]);
    expect(failed).toHaveLength(1);
    expect(failed[0]).toMatchObject({ success: false, error: 'click fixture' });

    const unsupported = await agent.executeActions([{ type: 'unsupported' } as any]);
    expect(unsupported).toHaveLength(1);
    expect(unsupported[0].success).toBe(false);
    await agent.close();
  });

  it('covers direct interaction defaults, scrolling, extraction, forms, navigation wait, and evaluation', async () => {
    const agent = new BrowserAgent({ screenshotDir, defaultTimeout: 321 });
    await agent.launch();
    await agent.click('#default');
    await agent.type('#default-input', 'text');
    await agent.scroll('top');
    await agent.scroll('bottom');
    await agent.scroll();
    await agent.wait(1);

    const element = { textContent: 'element fixture' };
    page.$.mockResolvedValueOnce(element).mockResolvedValueOnce(null);
    await expect(agent.extractText('#found')).resolves.toBe('element fixture');
    await expect(agent.extractText('#missing')).resolves.toBe('');
    await expect(agent.extractText()).resolves.toBe('body fixture');
    await expect(agent.extractLinks()).resolves.toEqual([
      { href: 'https://example.com/a', text: 'Link A' },
      { href: 'https://example.com/b', text: '' }
    ]);
    await agent.fillForm({ '#first': 'one', '#second': 'two' });
    await agent.waitForNavigation();
    await agent.waitForNavigation(45);
    await expect(agent.evaluate(() => 'custom result')).resolves.toBe('custom result');

    expect((global as any).window.scrollTo).toHaveBeenCalledWith(0, 0);
    expect((global as any).window.scrollTo).toHaveBeenCalledWith(0, 900);
    expect((global as any).window.scrollBy).toHaveBeenCalledWith(0, 500);
    expect(page.waitForNavigation).toHaveBeenNthCalledWith(1, { timeout: 321, waitUntil: 'networkidle2' });
    expect(page.waitForNavigation).toHaveBeenNthCalledWith(2, { timeout: 45, waitUntil: 'networkidle2' });
    await agent.close();
  });

  it('rejects page operations before launch', async () => {
    const agent = new BrowserAgent({ screenshotDir });
    await expect(agent.getPageInfo()).rejects.toThrow(/Browser not launched/);
    await expect(agent.executeActions([])).rejects.toThrow(/Browser not launched/);
    expect(() => agent.getStatus()).not.toThrow();
  });
});
