/**
 * Browser Agent
 * CDP (Chrome DevTools Protocol) browser integration for automation
 */

import { logger } from '../observability/logger';

export interface BrowserConfig {
    headless: boolean;
    defaultTimeout: number;
    screenshotDir: string;
    userAgent?: string;
    viewport: { width: number; height: number };
}

export interface PageInfo {
    url: string;
    title: string;
    content?: string;
    screenshot?: string;
}

export interface BrowserAction {
    type: 'click' | 'type' | 'scroll' | 'wait' | 'screenshot' | 'navigate';
    selector?: string;
    value?: string;
    timeout?: number;
}

export interface ActionResult {
    success: boolean;
    action: BrowserAction;
    duration: number;
    error?: string;
    data?: any;
}

export class BrowserAgent {
    private config: BrowserConfig;
    private browser: any = null;
    private page: any = null;
    private screenshotCount = 0;

    constructor(config?: Partial<BrowserConfig>) {
        this.config = {
            headless: true,
            defaultTimeout: 30000,
            screenshotDir: 'temp/screenshots',
            viewport: { width: 1280, height: 720 },
            ...config
        };
    }

    /**
     * Launch browser
     */
    async launch(): Promise<void> {
        try {
            const puppeteer = await import('puppeteer');

            this.browser = await puppeteer.default.launch({
                headless: this.config.headless,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage'
                ]
            });

            this.page = await this.browser.newPage();
            await this.page.setViewport(this.config.viewport);

            if (this.config.userAgent) {
                await this.page.setUserAgent(this.config.userAgent);
            }

            logger.info('Browser launched', { headless: this.config.headless });
        } catch (error: any) {
            logger.error('Failed to launch browser', { error: error.message });
            throw error;
        }
    }

    /**
     * Connect to existing Chrome instance via CDP
     */
    async connectCDP(port: number = 9222): Promise<void> {
        try {
            const puppeteer = await import('puppeteer');

            this.browser = await puppeteer.default.connect({
                browserURL: `http://localhost:${port}`,
                defaultViewport: this.config.viewport
            });

            const pages = await this.browser.pages();
            this.page = pages[0] || await this.browser.newPage();

            logger.info('Connected to Chrome via CDP', { port });
        } catch (error: any) {
            logger.error('Failed to connect to Chrome', { error: error.message });
            throw error;
        }
    }

    /**
     * Close browser
     */
    async close(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
            logger.info('Browser closed');
        }
    }

    /**
     * Navigate to URL
     */
    async navigate(url: string): Promise<PageInfo> {
        this.ensurePage();

        const startTime = Date.now();

        try {
            await this.page.goto(url, {
                waitUntil: 'networkidle2',
                timeout: this.config.defaultTimeout
            });

            const pageInfo = await this.getPageInfo();

            logger.info('Navigated to URL', {
                url,
                duration: Date.now() - startTime
            });

            return pageInfo;
        } catch (error: any) {
            logger.error('Navigation failed', { url, error: error.message });
            throw error;
        }
    }

    /**
     * Get current page info
     */
    async getPageInfo(): Promise<PageInfo> {
        this.ensurePage();

        const url = this.page.url();
        const title = await this.page.title();
        const content = await this.page.content();

        return { url, title, content };
    }

    /**
     * Take screenshot
     */
    async screenshot(fullPage: boolean = false): Promise<string> {
        this.ensurePage();

        const fs = await import('fs');
        const path = await import('path');

        // Ensure directory exists
        if (!fs.existsSync(this.config.screenshotDir)) {
            fs.mkdirSync(this.config.screenshotDir, { recursive: true });
        }

        const filename = `screenshot_${Date.now()}_${++this.screenshotCount}.png`;
        const filepath = path.join(this.config.screenshotDir, filename);

        await this.page.screenshot({
            path: filepath,
            fullPage
        });

        logger.info('Screenshot taken', { filepath });
        return filepath;
    }

    /**
     * Execute a series of browser actions
     */
    async executeActions(actions: BrowserAction[]): Promise<ActionResult[]> {
        this.ensurePage();

        const results: ActionResult[] = [];

        for (const action of actions) {
            const startTime = Date.now();
            let result: ActionResult = {
                success: false,
                action,
                duration: 0
            };

            try {
                switch (action.type) {
                    case 'click':
                        await this.click(action.selector!, action.timeout);
                        result.success = true;
                        break;

                    case 'type':
                        await this.type(action.selector!, action.value!, action.timeout);
                        result.success = true;
                        break;

                    case 'scroll':
                        await this.scroll(action.value);
                        result.success = true;
                        break;

                    case 'wait':
                        await this.wait(action.timeout || 1000);
                        result.success = true;
                        break;

                    case 'screenshot':
                        result.data = await this.screenshot(action.value === 'full');
                        result.success = true;
                        break;

                    case 'navigate':
                        result.data = await this.navigate(action.value!);
                        result.success = true;
                        break;
                }
            } catch (error: any) {
                result.error = error.message;
                logger.warn('Action failed', { action, error: error.message });
            }

            result.duration = Date.now() - startTime;
            results.push(result);

            if (!result.success) break; // Stop on failure
        }

        return results;
    }

    /**
     * Click element
     */
    async click(selector: string, timeout?: number): Promise<void> {
        this.ensurePage();

        await this.page.waitForSelector(selector, {
            timeout: timeout || this.config.defaultTimeout
        });
        await this.page.click(selector);
    }

    /**
     * Type text into element
     */
    async type(selector: string, text: string, timeout?: number): Promise<void> {
        this.ensurePage();

        await this.page.waitForSelector(selector, {
            timeout: timeout || this.config.defaultTimeout
        });
        await this.page.type(selector, text);
    }

    /**
     * Scroll page
     */
    async scroll(direction?: string): Promise<void> {
        this.ensurePage();

        await this.page.evaluate((dir: string) => {
            if (dir === 'top') {
                window.scrollTo(0, 0);
            } else if (dir === 'bottom') {
                window.scrollTo(0, document.body.scrollHeight);
            } else {
                window.scrollBy(0, 500);
            }
        }, direction || 'down');
    }

    /**
     * Wait for specified time
     */
    async wait(ms: number): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Extract text content from page
     */
    async extractText(selector?: string): Promise<string> {
        this.ensurePage();

        if (selector) {
            const element = await this.page.$(selector);
            if (element) {
                return await this.page.evaluate((el: Element) => el.textContent, element);
            }
            return '';
        }

        return await this.page.evaluate(() => document.body.innerText);
    }

    /**
     * Extract all links from page
     */
    async extractLinks(): Promise<{ href: string; text: string }[]> {
        this.ensurePage();

        return await this.page.evaluate(() => {
            return Array.from(document.querySelectorAll('a[href]')).map(a => ({
                href: (a as HTMLAnchorElement).href,
                text: a.textContent?.trim() || ''
            }));
        });
    }

    /**
     * Fill form fields
     */
    async fillForm(fields: Record<string, string>): Promise<void> {
        this.ensurePage();

        for (const [selector, value] of Object.entries(fields)) {
            await this.type(selector, value);
        }
    }

    /**
     * Wait for navigation
     */
    async waitForNavigation(timeout?: number): Promise<void> {
        this.ensurePage();

        await this.page.waitForNavigation({
            timeout: timeout || this.config.defaultTimeout,
            waitUntil: 'networkidle2'
        });
    }

    /**
     * Evaluate JavaScript in page context
     */
    async evaluate<T>(fn: () => T): Promise<T> {
        this.ensurePage();
        return await this.page.evaluate(fn);
    }

    /**
     * Check if browser is connected
     */
    isConnected(): boolean {
        return this.browser !== null && this.page !== null;
    }

    /**
     * Ensure page is available
     */
    private ensurePage(): void {
        if (!this.page) {
            throw new Error('Browser not launched. Call launch() or connectCDP() first.');
        }
    }

    /**
     * Get browser status
     */
    getStatus(): {
        connected: boolean;
        url: string | null;
        screenshotCount: number;
    } {
        return {
            connected: this.isConnected(),
            url: this.page?.url() || null,
            screenshotCount: this.screenshotCount
        };
    }
}
