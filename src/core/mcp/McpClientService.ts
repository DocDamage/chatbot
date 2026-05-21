import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { McpToolDefinition } from './McpToolRegistry';

export interface McpServerConfig {
  id?: string;
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  framing?: 'headers' | 'jsonl';
}

export interface McpCallResult {
  toolName: string;
  args: Record<string, any>;
  dryRun: boolean;
  ok: boolean;
  result?: any;
  error?: string;
}

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export class McpClientService {
  private serverId = 'unconfigured-mcp';
  private child?: ChildProcessWithoutNullStreams;
  private buffer = Buffer.alloc(0);
  private lineBuffer = '';
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private connected = false;
  private initialized = false;
  private framing: 'headers' | 'jsonl' = 'headers';

  async connectServer(config: McpServerConfig = {}): Promise<{ connected: boolean; serverId: string; mode: string; message: string }> {
    this.serverId = config.id || 'fl-studio-mcp';

    if (!config.command) {
      this.connected = false;
      return {
        connected: false,
        serverId: this.serverId,
        mode: 'dry_run',
        message: 'No MCP server command was configured. FL Studio control is available as dry-run planning only.'
      };
    }

    this.disconnect();
    this.framing = config.framing || 'headers';
    const useWindowsCommandShell = process.platform === 'win32' && /\.(cmd|bat)$/i.test(config.command);
    this.child = spawn(config.command, config.args || [], {
      cwd: config.cwd,
      env: { ...process.env, ...(config.env || {}) },
      stdio: 'pipe',
      shell: useWindowsCommandShell
    });

    this.child.stdout.on('data', data => this.handleOutput(Buffer.isBuffer(data) ? data : Buffer.from(data)));
    this.child.stderr.on('data', () => undefined);
    this.child.on('exit', () => {
      this.connected = false;
      this.rejectAll('MCP server exited.');
    });
    this.child.on('error', error => {
      this.connected = false;
      this.rejectAll(error.message);
    });

    this.connected = true;
    try {
      await this.initializeProtocol();
    } catch (error: any) {
      this.disconnect();
      return {
        connected: false,
        serverId: this.serverId,
        mode: 'dry_run',
        message: `MCP server started but did not complete initialization: ${error.message}`
      };
    }

    return {
      connected: true,
      serverId: this.serverId,
      mode: 'stdio',
      message: 'MCP server process started and initialized.'
    };
  }

  async listTools(): Promise<McpToolDefinition[]> {
    if (!this.connected) {
      return [];
    }

    const response = await this.sendRequest('tools/list', {});
    return response?.tools || [];
  }

  async callTool(toolName: string, args: Record<string, any> = {}, dryRun = false): Promise<McpCallResult> {
    if (dryRun || !this.connected) {
      return {
        toolName,
        args,
        dryRun: true,
        ok: true,
        result: {
          planned: true,
          message: this.connected
            ? 'Dry-run requested; MCP tool was not executed.'
            : 'MCP server is not connected; tool call was planned only.'
        }
      };
    }

    try {
      const result = await this.sendRequest('tools/call', {
        name: toolName,
        arguments: args
      });
      return { toolName, args, dryRun: false, ok: true, result };
    } catch (error: any) {
      return { toolName, args, dryRun: false, ok: false, error: error.message };
    }
  }

  healthCheck() {
    return {
      serverId: this.serverId,
      connected: this.connected,
      initialized: this.initialized,
      transport: this.connected ? 'stdio' : 'dry_run'
    };
  }

  disconnect(): void {
    if (this.child && !this.child.killed) {
      this.child.kill();
    }
    this.child = undefined;
    this.connected = false;
    this.initialized = false;
    this.rejectAll('MCP client disconnected.');
  }

  private async initializeProtocol(): Promise<void> {
    const response = await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'ai-chatbot-hub',
        version: '1.0.0'
      }
    });
    this.initialized = true;
    this.sendNotification('notifications/initialized', {});

    if (response?.serverInfo?.name) {
      this.serverId = response.serverInfo.name;
    }
  }

  private sendRequest(method: string, params: Record<string, any>): Promise<any> {
    if (!this.child || !this.connected) {
      return Promise.reject(new Error('MCP server is not connected.'));
    }

    const id = this.nextId++;
    const payload = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP request timed out: ${method}`));
      }, 15000);

      this.pending.set(id, { resolve, reject, timeout });
      this.writeMessage(payload);
    });
  }

  private sendNotification(method: string, params: Record<string, any>): void {
    if (!this.child || !this.connected) return;
    this.writeMessage({
      jsonrpc: '2.0',
      method,
      params
    });
  }

  private writeMessage(payload: Record<string, any>): void {
    const json = JSON.stringify(payload);
    if (this.framing === 'jsonl') {
      this.child!.stdin.write(`${json}\n`);
      return;
    }

    const body = Buffer.from(json, 'utf8');
    const header = Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, 'ascii');
    this.child!.stdin.write(Buffer.concat([header, body]));
  }

  private handleOutput(chunk: Buffer): void {
    if (this.framing === 'jsonl') {
      this.handleJsonLines(chunk);
      return;
    }

    this.buffer = Buffer.concat([this.buffer, chunk]);

    for (;;) {
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) return;

      const header = this.buffer.slice(0, headerEnd).toString('ascii');
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        this.buffer = this.buffer.slice(headerEnd + 4);
        continue;
      }

      const contentLength = Number(match[1]);
      const messageStart = headerEnd + 4;
      const messageEnd = messageStart + contentLength;
      if (this.buffer.length < messageEnd) return;

      const messageBody = this.buffer.slice(messageStart, messageEnd).toString('utf8');
      this.buffer = this.buffer.slice(messageEnd);
      this.handleMessage(messageBody);
    }
  }

  private handleJsonLines(chunk: Buffer): void {
    this.lineBuffer += chunk.toString('utf8');
    let index = this.lineBuffer.indexOf('\n');

    while (index >= 0) {
      const line = this.lineBuffer.slice(0, index).trim();
      this.lineBuffer = this.lineBuffer.slice(index + 1);
      if (line) this.handleMessage(line);
      index = this.lineBuffer.indexOf('\n');
    }
  }

  private handleMessage(body: string): void {
    let message: any;
    try {
      message = JSON.parse(body);
    } catch {
      return;
    }

    if (typeof message.id !== 'number') return;
    const pending = this.pending.get(message.id);
    if (!pending) return;

    clearTimeout(pending.timeout);
    this.pending.delete(message.id);

    if (message.error) {
      pending.reject(new Error(message.error.message || 'MCP tool call failed.'));
      return;
    }

    pending.resolve(message.result);
  }

  private rejectAll(message: string): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(message));
    }
    this.pending.clear();
  }
}
