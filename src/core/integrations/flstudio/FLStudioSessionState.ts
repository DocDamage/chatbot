import { McpControlMode } from '../../mcp/McpPermissionGate';

export interface FLStudioActionLog {
  timestamp: string;
  tool: string;
  args: Record<string, any>;
  dryRun: boolean;
  ok: boolean;
  message?: string;
}

export class FLStudioSessionState {
  mode: McpControlMode = 'dry_run';
  connected = false;
  serverId = 'fl-studio-mcp';
  lastCommand?: string;
  lastConnectionMessage?: string;
  private logEntries: FLStudioActionLog[] = [];

  setMode(mode?: McpControlMode): void {
    if (mode) this.mode = mode;
  }

  updateConnection(connected: boolean, serverId: string, message?: string): void {
    this.connected = connected;
    this.serverId = serverId;
    this.lastConnectionMessage = message;
  }

  addLog(entry: Omit<FLStudioActionLog, 'timestamp'>): void {
    this.logEntries.unshift({
      ...entry,
      timestamp: new Date().toISOString()
    });
    this.logEntries = this.logEntries.slice(0, 100);
  }

  snapshot() {
    return {
      connected: this.connected,
      serverId: this.serverId,
      mode: this.mode,
      lastCommand: this.lastCommand,
      lastConnectionMessage: this.lastConnectionMessage,
      limitations: [
        'FL Studio MCP control can work with existing patterns/channels and already-loaded plugins.',
        'It cannot reliably install or load new VST/AU plugins.',
        'It cannot guarantee brand-new FL pattern creation from nothing.',
        'Plugin parameters depend on what FL Studio exposes through the bridge.'
      ],
      log: this.logEntries.slice(0, 25)
    };
  }
}
