import { PyScrappyService } from './PyScrappyService';

describe('PyScrappyService', () => {
  const envKeys = [
    'PYSCRAPPY_MCP_COMMAND',
    'PYSCRAPPY_ENABLED',
    'PYSCRAPPY_MCP_ARGS',
    'PYSCRAPPY_MCP_CWD',
    'PYSCRAPPY_SCRAPE_TOOL',
    'PYSCRAPPY_MAX_OUTPUT_BYTES',
  ] as const;
  const originalEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));

  afterEach(() => {
    jest.restoreAllMocks();
    for (const key of envKeys) {
      const original = originalEnv[key];
      if (original === undefined) delete process.env[key];
      else process.env[key] = original;
    }
  });

  it('rejects private and local targets before contacting MCP', async () => {
    const service = new PyScrappyService({ command: 'not-used' });

    await expect(service.scrapeUrl('http://127.0.0.1:3001/health')).resolves.toMatchObject({
      success: false,
      error: 'Private or local network URLs are not allowed.'
    });
  });

  it('reports a useful disabled result when no MCP server is configured', async () => {
    const service = new PyScrappyService();

    await expect(service.scrapeUrl('https://example.com')).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining('PyScrappy is not configured')
    });
  });

  it('rejects unsupported URL schemes', async () => {
    const service = new PyScrappyService({ command: 'not-used' });

    await expect(service.scrapeUrl('file:///etc/passwd')).resolves.toMatchObject({
      success: false,
      error: 'Only HTTP(S) URLs are allowed.'
    });
  });

  it.each([
    'not a url',
    'http://localhost/path',
    'https://host.local/path',
    'http://0.0.0.0/path',
    'http://[::1]/path',
    'http://169.254.169.254/latest/meta-data',
    'http://127.1.2.3/path',
    'http://10.1.2.3/path',
    'http://192.168.1.2/path',
    'http://172.16.1.2/path',
    'http://172.31.1.2/path',
  ])('rejects unsafe target %s', async url => {
    const service = new PyScrappyService({ command: 'not-used' });
    const result = await service.scrapeUrl(url);
    expect(result.success).toBe(false);
  });

  it('builds configuration from environment fallbacks and parses argument formats', () => {
    process.env.PYSCRAPPY_ENABLED = 'true';
    process.env.PYSCRAPPY_MCP_ARGS = '["--port", 9000]';
    process.env.PYSCRAPPY_MCP_CWD = '/tmp/pyscrappy';
    process.env.PYSCRAPPY_SCRAPE_TOOL = 'fetch_page';
    process.env.PYSCRAPPY_MAX_OUTPUT_BYTES = '321.9';

    const configured = PyScrappyService.fromEnv() as any;
    expect(configured.config).toMatchObject({
      command: 'pyscrappy-mcp',
      args: ['--port', '9000'],
      cwd: '/tmp/pyscrappy',
      toolName: 'fetch_page',
      maxOutputBytes: 321,
    });

    process.env.PYSCRAPPY_MCP_COMMAND = 'custom-command';
    process.env.PYSCRAPPY_MCP_ARGS = '--mode "render js"';
    process.env.PYSCRAPPY_MAX_OUTPUT_BYTES = '-1';
    const fallback = PyScrappyService.fromEnv() as any;
    expect(fallback.config.command).toBe('custom-command');
    expect(fallback.config.args).toEqual(['--mode', 'render js']);
    expect(fallback.config.maxOutputBytes).toBe(200_000);

    delete process.env.PYSCRAPPY_MCP_ARGS;
    delete process.env.PYSCRAPPY_MCP_CWD;
    expect((PyScrappyService.fromEnv() as any).config.args).toBeUndefined();
    expect((PyScrappyService.fromEnv() as any).config.cwd).toBeUndefined();
  });

  it('connects, discovers a compatible tool, filters options, truncates output, and reuses the connection', async () => {
    const service = new PyScrappyService({ command: 'pyscrappy', maxOutputBytes: 150 });
    const client = (service as any).client;
    client.connectServer = jest.fn().mockResolvedValue({ connected: true, message: 'ok' });
    client.listTools = jest.fn().mockResolvedValue([{ name: 'vendor_scrape' }]);
    client.callTool = jest.fn().mockResolvedValue({ ok: true, result: { body: 'x'.repeat(500) } });
    client.healthCheck = jest.fn().mockReturnValue({ connected: true, serverId: 'pyscrappy' });
    client.disconnect = jest.fn();

    const first = await service.scrapeUrl('https://example.com/page', {
      render_js: false,
      max_pages: 0,
      selectors: ['article'],
      css_selector: 'main',
      ignored: true,
    });
    expect(first).toMatchObject({
      success: true,
      data: { tool: 'vendor_scrape', result: { truncated: true, maxOutputBytes: 150 } },
    });
    expect(client.callTool).toHaveBeenCalledWith('vendor_scrape', {
      url: 'https://example.com/page',
      render_js: false,
      max_pages: 0,
      selectors: { content: 'main' },
    });

    await service.scrapeUrl('https://example.org', { css_selector: '   ' });
    expect(client.connectServer).toHaveBeenCalledTimes(1);
    await expect(service.getStatus()).resolves.toMatchObject({
      enabled: true,
      configured: true,
      connected: true,
      serverId: 'pyscrappy',
      tools: ['vendor_scrape'],
    });
    service.close();
    expect(client.disconnect).toHaveBeenCalled();
  });

  it('uses an explicitly configured tool and preserves small or undefined results', async () => {
    const service = new PyScrappyService({ command: 'pyscrappy', toolName: 'exact_tool' });
    const client = (service as any).client;
    client.connectServer = jest.fn().mockResolvedValue({ connected: true });
    client.listTools = jest.fn().mockResolvedValue([]);
    client.callTool = jest.fn()
      .mockResolvedValueOnce({ ok: true, result: { title: 'small' } })
      .mockResolvedValueOnce({ ok: true, result: undefined });

    await expect(service.scrapeUrl('https://example.com')).resolves.toMatchObject({
      success: true,
      data: { tool: 'exact_tool', result: { title: 'small' } },
    });
    await expect(service.scrapeUrl('https://example.com/empty')).resolves.toMatchObject({
      success: true,
      data: { tool: 'exact_tool', result: undefined },
    });
  });

  it('reports connection, discovery, and tool-call failures without throwing', async () => {
    const connectionFailure = new PyScrappyService({ command: 'pyscrappy' });
    (connectionFailure as any).client.connectServer = jest.fn().mockResolvedValue({
      connected: false,
      message: 'connection refused',
    });
    await expect(connectionFailure.scrapeUrl('https://example.com')).resolves.toMatchObject({
      success: false,
      error: 'connection refused',
    });

    const missingTool = new PyScrappyService({ command: 'pyscrappy' });
    (missingTool as any).client.connectServer = jest.fn().mockResolvedValue({ connected: true });
    (missingTool as any).client.listTools = jest.fn().mockResolvedValue([{ name: 'unrelated' }]);
    await expect(missingTool.scrapeUrl('https://example.com')).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining('does not expose'),
    });

    const failedCall = new PyScrappyService({ command: 'pyscrappy', toolName: 'scrape_url' });
    (failedCall as any).client.connectServer = jest.fn().mockResolvedValue({ connected: true });
    (failedCall as any).client.listTools = jest.fn().mockResolvedValue([{ name: 'scrape_url' }]);
    (failedCall as any).client.callTool = jest.fn().mockResolvedValue({ ok: false });
    await expect(failedCall.scrapeUrl('https://example.com')).resolves.toMatchObject({
      success: false,
      error: 'PyScrappy tool call failed.',
    });
  });

  it('exposes the tool contract and routes executions through scrapeUrl', async () => {
    const service = new PyScrappyService();
    const tool = service.createTool();
    expect(tool.id).toBe('pyscrappy_scrape_url');
    await expect(tool.execute({ url: '' })).resolves.toMatchObject({
      success: false,
      error: 'A valid HTTP(S) URL is required.',
    });
  });
});
