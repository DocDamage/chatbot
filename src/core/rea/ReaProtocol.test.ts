import fs from 'fs';
import os from 'os';
import path from 'path';
import { runRea } from './ReaProtocol';
import { ReaConfig } from './ReaConfig';

describe('REA MCP protocol integration', () => {
  let root: string, config: ReaConfig;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'rea-protocol-'));
    fs.writeFileSync(path.join(root, 'app.js'), '42');
    fs.writeFileSync(path.join(root, 'bad.js'), '42');
    const entry = path.join(root, 'server.cjs');
    fs.writeFileSync(entry, `
      const fs = require('fs');
      const readline = require('readline');
      const tools = ['analyze_javascript_application', 'inspect_model_artifact', 'inspect_managed_artifact', 'open_binary', 'binary_overview', 'analyze_function', 'close_binary', 'export_evidence_bundle'];
      readline.createInterface({ input: process.stdin }).on('line', line => {
        const request = JSON.parse(line);
        if (!request.id) return;
        let result = {};
        if (request.method === 'initialize') result = { serverInfo: { name: 'rea-fixture' } };
        if (request.method === 'tools/list') result = { tools: tools.map(name => ({ name })) };
        if (request.method === 'tools/call') {
          const { name, arguments: args } = request.params;
          fs.appendFileSync('calls.jsonl', JSON.stringify({ name, args }) + '\\n');
          if (args.input_path?.endsWith('bad') || args.procedure === 'missing') result = { isError: true, content: [{ type: 'text', text: 'Unsupported artifact' }] };
          else if (name === 'export_evidence_bundle') { fs.writeFileSync(args.path, '{"retained":"complete"}'); result = { structuredContent: { path: args.path } }; }
          else result = { structuredContent: { evidence_id: 'ev_fixture', normalized_result: { findings: ['observed'] }, authority: 'static', limitations: ['runtime unknown'], raw_result: 'retained only in export' } };
        }
        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }) + '\\n');
      });
    `);
    config = { enabled: true, node: process.execPath, entry, dataRoot: root, allowedRoots: [root], timeoutMs: 3000, maxInputBytes: 4096, maxFiles: 10 };
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
  it('uses actual stdio transport and exports retained evidence before disconnecting', async () => {
    const result = await runRea(config, path.join(root, 'app.js'), 'javascript', root, () => {});
    expect(result[0]).toMatchObject({ evidenceId: 'ev_fixture', result: { limitations: ['runtime unknown'] } });
    expect(result[0].result.raw_result).toBeUndefined();
    expect(fs.existsSync(path.join(root, 'evidence.json'))).toBe(true);
    expect(fs.readFileSync(path.join(root, 'calls.jsonl'), 'utf8')).toContain('export_evidence_bundle');
    const first = JSON.parse(fs.readFileSync(path.join(root, 'calls.jsonl'), 'utf8').split('\n')[0]);
    expect(first.args.input_path).toBe(root);
  });
  it('surfaces MCP isError instead of falsely reporting successful analysis', async () => {
    fs.mkdirSync(path.join(root, 'bad'));
    await expect(runRea(config, path.join(root, 'bad'), 'javascript', root, () => {})).rejects.toThrow('Unsupported artifact');
    expect(fs.existsSync(path.join(root, 'evidence.json'))).toBe(false);
  });
  it('uses summary dossiers for selected native functions and closes the target', async () => {
    await runRea(config, 'app.exe', 'native', root, () => {}, undefined, 'main');
    const calls = fs.readFileSync(path.join(root, 'calls.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
    expect(calls.find(call => call.name === 'analyze_function').args).toEqual({ procedure: 'main', detail: 'summary' });
    expect(calls.map(call => call.name)).toEqual(['open_binary', 'binary_overview', 'analyze_function', 'export_evidence_bundle', 'close_binary']);
  });
  it('exports partial observations while preserving a later failure', async () => {
    await expect(runRea(config, 'app.exe', 'native', root, () => {}, undefined, 'missing')).rejects.toMatchObject({ steps: expect.arrayContaining([expect.objectContaining({ tool: 'binary_overview' })]) });
    expect(fs.existsSync(path.join(root, 'evidence.json'))).toBe(true);
  });
  it.each(['model', 'managed'] as const)('inspects %s by explicit path without opening a native target', async operation => {
    await runRea(config, 'artifact', operation, root, () => {});
    const calls = fs.readFileSync(path.join(root, 'calls.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
    expect(calls[0]).toEqual({ name: operation === 'model' ? 'inspect_model_artifact' : 'inspect_managed_artifact', args: { path: 'artifact', detail: 'summary' } });
    expect(calls.some(call => call.name === 'open_binary')).toBe(false);
  });
});
