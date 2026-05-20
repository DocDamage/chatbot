import { McpAuditLogger } from '../../mcp/McpAuditLogger';
import { McpControlMode } from '../../mcp/McpPermissionGate';
import { FLStudioCommandPlanner, FLStudioToolAction } from './FLStudioCommandPlanner';
import { FLStudioMcpClient } from './FLStudioMcpClient';
import { FLStudioSafetyGate } from './FLStudioSafetyGate';
import { FLStudioSessionState } from './FLStudioSessionState';

export interface FLStudioControlOptions {
  mode?: McpControlMode;
  confirmed?: boolean;
}

export class FLStudioControlAgent {
  constructor(
    private client = new FLStudioMcpClient(),
    private planner = new FLStudioCommandPlanner(),
    private safetyGate = new FLStudioSafetyGate(),
    private session = new FLStudioSessionState(),
    private audit = new McpAuditLogger()
  ) {}

  async connect(config: Record<string, any> = {}) {
    this.session.setMode(config.mode);
    const result = await this.client.connect({
      command: config.command || process.env.FL_STUDIO_MCP_COMMAND || 'fl-studio-mcp.cmd',
      args: config.args || this.envArgs(),
      cwd: config.cwd || process.env.FL_STUDIO_MCP_CWD,
      framing: config.framing || 'jsonl'
    });
    this.session.updateConnection(result.connected, result.serverId, result.message);
    return {
      ...result,
      state: this.session.snapshot()
    };
  }

  status() {
    const status = this.client.status();
    this.session.updateConnection(status.connected, status.serverId);
    return {
      ...status,
      state: this.session.snapshot()
    };
  }

  async tools() {
    const tools = await this.client.listTools();
    return {
      connected: this.client.status().connected,
      tools,
      toolNames: tools.map(tool => tool.name)
    };
  }

  state() {
    return this.session.snapshot();
  }

  disconnect() {
    this.client.disconnect();
    this.session.updateConnection(false, this.session.serverId, 'MCP client disconnected.');
    return this.session.snapshot();
  }

  plan(query: string) {
    return this.planner.plan(query);
  }

  async command(query: string, options: FLStudioControlOptions = {}) {
    return this.executeActions(this.planner.plan(query), query, options);
  }

  async callTool(toolName: string, args: Record<string, any> = {}, options: FLStudioControlOptions = {}) {
    return this.executeActions([
      {
        tool: toolName,
        args,
        description: `Direct FL Studio MCP tool call: ${toolName}.`
      }
    ], `Direct tool call ${toolName}.`, options);
  }

  async executeActions(actions: FLStudioToolAction[], query: string, options: FLStudioControlOptions = {}) {
    const mode = options.mode || this.session.mode || 'dry_run';
    this.session.setMode(mode);
    this.session.lastCommand = query;

    const results = [];
    for (const action of actions) {
      const decision = this.safetyGate.evaluate(action.tool, mode, options.confirmed);
      if (!decision.allowed) {
        this.audit.log({
          serverId: this.session.serverId,
          toolName: action.tool,
          args: action.args,
          mode,
          outcome: 'blocked',
          message: decision.reason
        });
        this.session.addLog({
          tool: action.tool,
          args: action.args,
          dryRun: false,
          ok: false,
          message: decision.reason
        });
        results.push({ action, decision, ok: false, blocked: true });
        continue;
      }

      const call = await this.client.call(action.tool, action.args, decision.dryRun);
      this.audit.log({
        serverId: this.session.serverId,
        toolName: action.tool,
        args: action.args,
        mode,
        outcome: call.ok ? (call.dryRun ? 'dry_run' : 'allowed') : 'error',
        message: call.error || decision.reason
      });
      this.session.addLog({
        tool: action.tool,
        args: action.args,
        dryRun: call.dryRun,
        ok: call.ok,
        message: call.error || decision.reason
      });
      results.push({ action, decision, call, ok: call.ok });
    }

    const dryRun = results.every(result => result.call?.dryRun || result.decision?.dryRun || result.blocked);
    return {
      domain: 'music',
      mode: 'fl_studio_control',
      controlMode: mode,
      dryRun,
      query,
      actions,
      results,
      toolResults: results.map(result => ({
        tool: result.action?.tool,
        ok: result.ok,
        blocked: !!result.blocked,
        dryRun: result.call?.dryRun ?? result.decision?.dryRun ?? false,
        result: result.call?.result,
        error: result.call?.error,
        reason: result.decision?.reason
      })),
      state: this.session.snapshot(),
      response: this.formatResponse(query, mode, actions, results),
      limitations: this.session.snapshot().limitations,
      model: 'fl-studio-mcp-control'
    };
  }

  private formatResponse(query: string, mode: McpControlMode, actions: FLStudioToolAction[], results: any[]) {
    const status = mode === 'dry_run'
      ? 'I planned the FL Studio control actions without touching your DAW.'
      : 'I processed the FL Studio control actions through the MCP safety gate.';

    const blocked = results.filter(result => result.blocked);
    return [
      'FL Studio Control Agent',
      '',
      `Request: ${query}`,
      `Mode: ${mode}`,
      status,
      '',
      'Planned actions:',
      ...actions.map((action, index) => `${index + 1}. ${action.tool} ${JSON.stringify(action.args)} - ${action.description}`),
      ...(blocked.length > 0 ? ['', 'Blocked actions:', ...blocked.map(result => `- ${result.action.tool}: ${result.decision.reason}`)] : []),
      '',
      'Current limits:',
      '- I can control transport, mixer, Channel Rack/steps, Piano Roll notes/chords, and exposed plugin parameters through a connected MCP bridge.',
      '- I will not claim full FLP/project automation; VST loading and brand-new pattern creation are bridge/API-limited.'
    ].join('\n');
  }

  private envArgs(): string[] | undefined {
    const raw = process.env.FL_STUDIO_MCP_ARGS;
    if (!raw) return undefined;
    return raw.split(' ').filter(Boolean);
  }
}
