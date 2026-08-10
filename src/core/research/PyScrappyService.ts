import { Tool, ToolCategory, ToolResult } from '../../types/tools';
import { McpClientService } from '../mcp/McpClientService';
import { logger } from '../observability/logger';

export interface PyScrappyConfig {
  command?: string;
  args?: string[];
  cwd?: string;
  toolName?: string;
  maxOutputBytes?: number;
}

export interface PyScrappyStatus {
  enabled: boolean;
  configured: boolean;
  connected: boolean;
  serverId: string;
  tools: string[];
}

/**
 * Optional PyScrappy bridge.
 *
 * PyScrappy is kept behind MCP so its Python/browser dependencies remain
 * outside the chatbot process. The bridge applies the same URL boundary used
 * by online knowledge ingestion before any external tool is called.
 */
export class PyScrappyService {
  private readonly client = new McpClientService();
  private readonly config: Required<Pick<PyScrappyConfig, 'maxOutputBytes'>> & PyScrappyConfig;
  private connected = false;
  private tools: string[] = [];

  constructor(config: PyScrappyConfig = {}) {
    this.config = {
      maxOutputBytes: 200_000,
      ...config,
    };
  }

  static fromEnv(): PyScrappyService {
    return new PyScrappyService({
      command: process.env.PYSCRAPPY_MCP_COMMAND || (process.env.PYSCRAPPY_ENABLED === 'true' ? 'pyscrappy-mcp' : undefined),
      args: parseArgs(process.env.PYSCRAPPY_MCP_ARGS),
      cwd: process.env.PYSCRAPPY_MCP_CWD || undefined,
      toolName: process.env.PYSCRAPPY_SCRAPE_TOOL || 'scrape_url',
      maxOutputBytes: parsePositiveInt(process.env.PYSCRAPPY_MAX_OUTPUT_BYTES, 200_000),
    });
  }

  isConfigured(): boolean {
    return Boolean(this.config.command);
  }

  close(): void {
    this.client.disconnect();
    this.connected = false;
    this.tools = [];
  }

  async getStatus(): Promise<PyScrappyStatus> {
    if (this.isConfigured() && !this.connected) {
      await this.ensureConnected();
    }

    const health = this.client.healthCheck();
    return {
      enabled: this.isConfigured(),
      configured: this.isConfigured(),
      connected: health.connected,
      serverId: health.serverId,
      tools: this.tools,
    };
  }

  async scrapeUrl(url: string, options: Record<string, unknown> = {}): Promise<ToolResult> {
    const startedAt = Date.now();
    const urlError = validateExternalUrl(url);
    if (urlError) {
      return { success: false, error: urlError, metadata: { executionTime: Date.now() - startedAt } };
    }

    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'PyScrappy is not configured. Set PYSCRAPPY_ENABLED=true and PYSCRAPPY_MCP_COMMAND.',
        metadata: { executionTime: Date.now() - startedAt },
      };
    }

    try {
      await this.ensureConnected();
      const toolName = this.config.toolName || this.findTool('scrape_url') || this.findTool('scrape');
      if (!toolName) throw new Error('The configured PyScrappy MCP server does not expose a URL scraper tool.');

      const result = await this.client.callTool(toolName, {
        url,
        ...pickScrapeOptions(options),
      });
      if (!result.ok) throw new Error(result.error || 'PyScrappy tool call failed.');

      const data = limitOutput(result.result, this.config.maxOutputBytes);
      return {
        success: true,
        data: { url, tool: toolName, result: data },
        metadata: { executionTime: Date.now() - startedAt },
      };
    } catch (error: any) {
      logger.warn('PyScrappy scrape failed', { url, error: error.message });
      return { success: false, error: error.message, metadata: { executionTime: Date.now() - startedAt } };
    }
  }

  createTool(): Tool {
    return {
      id: 'pyscrappy_scrape_url',
      name: 'scrape_web_page',
      description: 'Fetch and extract structured content from a public HTTP(S) URL using the optional PyScrappy MCP server.',
      category: ToolCategory.WEB_SEARCH,
      parameters: [
        { name: 'url', type: 'string', description: 'Public HTTP(S) URL to inspect.', required: true },
        { name: 'render_js', type: 'boolean', description: 'Ask PyScrappy to render JavaScript when supported.', required: false },
        { name: 'max_pages', type: 'number', description: 'Maximum number of linked pages to crawl when supported.', required: false },
        { name: 'css_selector', type: 'string', description: 'Optional CSS selector to narrow extraction.', required: false },
      ],
      execute: async params => this.scrapeUrl(String(params.url || ''), params),
    };
  }

  private async ensureConnected(): Promise<void> {
    if (this.connected) return;

    const result = await this.client.connectServer({
      id: 'pyscrappy',
      command: this.config.command,
      args: this.config.args,
      cwd: this.config.cwd,
      framing: 'jsonl',
    });
    if (!result.connected) throw new Error(result.message);
    this.connected = true;
    this.tools = (await this.client.listTools()).map(tool => tool.name);
  }

  private findTool(preferred: string): string | undefined {
    return this.tools.find(tool => tool === preferred) || this.tools.find(tool => tool.includes(preferred));
  }
}

function parseArgs(value?: string): string[] | undefined {
  if (!value?.trim()) return undefined;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    // Fall back to a small shell-independent argument splitter.
  }
  return value.match(/(?:[^\s"]+|"[^"]*")+/g)?.map(item => item.replace(/^"|"$/g, ''));
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function pickScrapeOptions(options: Record<string, unknown>): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  if (options.render_js !== undefined) picked.render_js = options.render_js;
  if (options.max_pages !== undefined) picked.max_pages = options.max_pages;
  if (options.selectors !== undefined) picked.selectors = options.selectors;
  if (typeof options.css_selector === 'string' && options.css_selector.trim()) {
    picked.selectors = { content: options.css_selector };
  }
  return picked;
}

function limitOutput(value: unknown, maxBytes: number): unknown {
  const serialized = JSON.stringify(value) ?? String(value);
  if (Buffer.byteLength(serialized, 'utf8') <= maxBytes) return value;
  return {
    truncated: true,
    maxOutputBytes: maxBytes,
    preview: serialized.slice(0, Math.max(0, maxBytes - 120)),
  };
}

function validateExternalUrl(value: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return 'A valid HTTP(S) URL is required.';
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) return 'Only HTTP(S) URLs are allowed.';
  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.local') ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname === '[::1]' ||
    hostname === '169.254.169.254' ||
    /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(hostname)
  ) {
    return 'Private or local network URLs are not allowed.';
  }
  return undefined;
}
