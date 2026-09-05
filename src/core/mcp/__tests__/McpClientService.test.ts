import { McpClientService } from '../McpClientService';

describe('RT-MCP-001: McpClientService Protocol, Execution, and Governance Suite', () => {
  let service: McpClientService;

  beforeEach(() => {
    service = new McpClientService();
  });

  afterEach(() => {
    service.disconnect();
  });

  it('handles unconfigured server command with dry-run fallback', async () => {
    const res = await service.connectServer({});
    expect(res.connected).toBe(false);
    expect(res.mode).toBe('dry_run');
    expect(res.message).toContain('No MCP server command was configured');

    const health = service.healthCheck();
    expect(health.connected).toBe(false);
    expect(health.transport).toBe('dry_run');

    const tools = await service.listTools();
    expect(tools).toEqual([]);

    const callRes = await service.callTool('any_tool', { a: 1 }, false);
    expect(callRes.dryRun).toBe(true);
    expect(callRes.ok).toBe(true);
    expect(callRes.result.planned).toBe(true);
  });

  it('connects to an MCP stdio server using headers framing, handles initialize, tools/list, and tools/call', async () => {
    // Spawn a mock node MCP server using stdio with Content-Length headers
    const mockServerScript = `
      let buffer = Buffer.alloc(0);
      process.stdin.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        for (;;) {
          const headerEnd = buffer.indexOf('\\r\\n\\r\\n');
          if (headerEnd === -1) return;
          const header = buffer.slice(0, headerEnd).toString('ascii');
          const match = header.match(/Content-Length:\\s*(\\d+)/i);
          if (!match) {
            buffer = buffer.slice(headerEnd + 4);
            continue;
          }
          const len = Number(match[1]);
          const start = headerEnd + 4;
          const end = start + len;
          if (buffer.length < end) return;
          const body = JSON.parse(buffer.slice(start, end).toString('utf8'));
          buffer = buffer.slice(end);

          if (body.method === 'initialize') {
            const resp = JSON.stringify({
              jsonrpc: '2.0',
              id: body.id,
              result: { serverInfo: { name: 'mock-mcp-server', version: '1.0' }, capabilities: {} }
            });
            const out = Buffer.from(resp, 'utf8');
            process.stdout.write(Buffer.concat([Buffer.from('Content-Length: ' + out.length + '\\r\\n\\r\\n', 'ascii'), out]));
          } else if (body.method === 'tools/list') {
            const resp = JSON.stringify({
              jsonrpc: '2.0',
              id: body.id,
              result: { tools: [{ name: 'test_tool', description: 'A test tool' }] }
            });
            const out = Buffer.from(resp, 'utf8');
            process.stdout.write(Buffer.concat([Buffer.from('Content-Length: ' + out.length + '\\r\\n\\r\\n', 'ascii'), out]));
          } else if (body.method === 'tools/call') {
            if (body.params.name === 'error_tool') {
              const resp = JSON.stringify({
                jsonrpc: '2.0',
                id: body.id,
                error: { message: 'Tool execution failed' }
              });
              const out = Buffer.from(resp, 'utf8');
              process.stdout.write(Buffer.concat([Buffer.from('Content-Length: ' + out.length + '\\r\\n\\r\\n', 'ascii'), out]));
            } else {
              const resp = JSON.stringify({
                jsonrpc: '2.0',
                id: body.id,
                result: { success: true, echoed: body.params.arguments }
              });
              const out = Buffer.from(resp, 'utf8');
              process.stdout.write(Buffer.concat([Buffer.from('Content-Length: ' + out.length + '\\r\\n\\r\\n', 'ascii'), out]));
            }
          }
        }
      });
    `;

    const connectRes = await service.connectServer({
      command: process.execPath,
      args: ['-e', mockServerScript],
      framing: 'headers'
    });

    expect(connectRes.connected).toBe(true);
    expect(connectRes.mode).toBe('stdio');

    const health = service.healthCheck();
    expect(health.connected).toBe(true);
    expect(health.initialized).toBe(true);

    // List tools
    const tools = await service.listTools();
    expect(tools.length).toBe(1);
    expect(tools[0].name).toBe('test_tool');

    // Call tool dry-run
    const dryRunResult = await service.callTool('test_tool', { x: 10 }, true);
    expect(dryRunResult.dryRun).toBe(true);
    expect(dryRunResult.result.planned).toBe(true);

    // Call tool live
    const liveResult = await service.callTool('test_tool', { x: 10 }, false);
    expect(liveResult.ok).toBe(true);
    expect(liveResult.result.success).toBe(true);
    expect(liveResult.result.echoed).toEqual({ x: 10 });

    // Call tool error branch
    const errorResult = await service.callTool('error_tool', {}, false);
    expect(errorResult.ok).toBe(false);
    expect(errorResult.error).toBe('Tool execution failed');
  });

  it('connects to an MCP stdio server using jsonl framing', async () => {
    const mockJsonlScript = `
      const readline = require('readline');
      const rl = readline.createInterface({ input: process.stdin });
      rl.on('line', (line) => {
        if (!line.trim()) return;
        const body = JSON.parse(line);
        if (body.method === 'initialize') {
          process.stdout.write(JSON.stringify({
            jsonrpc: '2.0',
            id: body.id,
            result: { serverInfo: { name: 'jsonl-server' } }
          }) + '\\n');
        } else if (body.method === 'tools/list') {
          process.stdout.write(JSON.stringify({
            jsonrpc: '2.0',
            id: body.id,
            result: { tools: [{ name: 'jsonl_tool' }] }
          }) + '\\n');
        }
      });
    `;

    const connectRes = await service.connectServer({
      command: process.execPath,
      args: ['-e', mockJsonlScript],
      framing: 'jsonl'
    });

    expect(connectRes.connected).toBe(true);
    const tools = await service.listTools();
    expect(tools.length).toBe(1);
    expect(tools[0].name).toBe('jsonl_tool');
  });

  it('handles server startup failure and immediate exit', async () => {
    const connectRes = await service.connectServer({
      command: process.execPath,
      args: ['-e', 'process.exit(1);']
    });

    expect(connectRes.connected).toBe(false);
    expect(connectRes.mode).toBe('dry_run');
    expect(connectRes.message).toContain('did not complete initialization');
  });
});
