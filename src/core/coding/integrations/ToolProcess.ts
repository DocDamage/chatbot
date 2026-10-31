import { spawn, spawnSync } from 'child_process';
import { McpClientService, McpServerConfig } from '../../mcp/McpClientService';
import { CodingToolError } from './CodingToolConfig';
import { StringDecoder } from 'string_decoder';

export async function withMcp<T>(config: McpServerConfig, work: (call: (name: string, args: Record<string, unknown>) => Promise<any>) => Promise<T>, signal?: AbortSignal): Promise<T> {
  const client = new McpClientService();
  const abort = () => client.disconnect();
  if (signal?.aborted) throw new CodingToolError('Coding tool cancelled.', 409);
  signal?.addEventListener('abort', abort, { once: true });
  try {
    const connected = await client.connectServer({ ...config, framing: 'jsonl', killProcessTree: true, maxMessageBytes: 8 * 1048576 });
    if (!connected.connected) throw new CodingToolError(signal?.aborted ? 'Coding tool cancelled.' : connected.message, signal?.aborted ? 409 : 503, 'CODING_TOOL_UNAVAILABLE');
    const names = new Set((await client.listTools()).map(tool => tool.name));
    return await work(async (name, args) => {
      if (signal?.aborted) throw new CodingToolError('Coding tool cancelled.', 409);
      if (!names.has(name)) throw new CodingToolError(`The installed server does not advertise ${name}.`, 503);
      const response = await client.callTool(name, args);
      if (!response.ok || response.dryRun || response.result?.isError) throw new CodingToolError(response.error || response.result?.content?.find((item: any) => item.type === 'text')?.text || `${name} failed.`, 502);
      const text = response.result?.content?.filter((item: any) => item.type === 'text').map((item: any) => item.text).join('\n') || '';
      if (/^(?:Error:|Error executing tool|Unauthorized|Rate limit)/i.test(text)) throw new CodingToolError(text, 502);
      return { tool: name, content: text, structured: response.result?.structuredContent };
    });
  } finally { signal?.removeEventListener('abort', abort); client.disconnect(); }
}

export function runTool(command: string, args: string[], cwd: string, timeoutMs: number,
  env: NodeJS.ProcessEnv = process.env, signal?: AbortSignal): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  if (signal?.aborted) return Promise.reject(new CodingToolError('Coding tool cancelled.', 409));
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', done = false;
    const decoder = new StringDecoder('utf8');
    const finish = (error?: Error, code = -1) => {
      if (done) return; done = true; clearTimeout(timer); signal?.removeEventListener('abort', abort);
      if (error) {
        if (process.platform === 'win32' && child.pid) spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', timeout: 5000 });
        child.kill(); reject(error);
      } else resolve({ stdout, stderr, exitCode: code });
    };
    const abort = () => finish(new CodingToolError('Coding tool cancelled.', 409));
    const timer = setTimeout(() => finish(new CodingToolError('Coding tool exceeded its time budget.', 504, 'CODING_TOOL_TIMEOUT')), timeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    child.stdout.on('data', chunk => { stdout += decoder.write(chunk); if (Buffer.byteLength(stdout) > 2 * 1048576) finish(new CodingToolError('Coding tool output budget exceeded.', 413)); });
    child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-16000); });
    child.on('error', error => finish(new CodingToolError(error.message, 503)));
    child.on('close', code => finish(undefined, code ?? -1));
  });
}
