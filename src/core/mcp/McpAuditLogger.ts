export interface McpAuditEntry {
  id: string;
  timestamp: string;
  serverId: string;
  toolName: string;
  args: Record<string, any>;
  mode: string;
  outcome: 'dry_run' | 'allowed' | 'blocked' | 'error';
  message?: string;
}

export class McpAuditLogger {
  private entries: McpAuditEntry[] = [];
  private maxEntries: number;

  constructor(maxEntries = 250) {
    this.maxEntries = maxEntries;
  }

  log(entry: Omit<McpAuditEntry, 'id' | 'timestamp'>): McpAuditEntry {
    const fullEntry: McpAuditEntry = {
      ...entry,
      id: `mcp-audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString()
    };

    this.entries.unshift(fullEntry);
    this.entries = this.entries.slice(0, this.maxEntries);
    return fullEntry;
  }

  list(limit = 50): McpAuditEntry[] {
    return this.entries.slice(0, limit);
  }
}
