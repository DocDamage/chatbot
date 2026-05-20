export type McpControlMode = 'dry_run' | 'confirm_required' | 'live_control';

export interface McpPermissionRequest {
  toolName: string;
  args?: Record<string, any>;
  mode?: McpControlMode;
  confirmed?: boolean;
}

export interface McpPermissionDecision {
  allowed: boolean;
  dryRun: boolean;
  requiresConfirmation: boolean;
  risk: 'low' | 'medium' | 'high';
  reason: string;
}

const RISKY_TOOL_PATTERNS = [
  /clear/i,
  /delete/i,
  /overwrite/i,
  /mute_all/i,
  /set_all/i,
  /plugin_param/i,
  /record/i,
  /export/i,
  /render/i
];

export class McpPermissionGate {
  private riskyTools: Set<string>;

  constructor(riskyTools: string[] = []) {
    this.riskyTools = new Set(riskyTools);
  }

  evaluate(request: McpPermissionRequest): McpPermissionDecision {
    const mode = request.mode || 'dry_run';
    const risk = this.getRisk(request.toolName);

    if (mode === 'dry_run') {
      return {
        allowed: true,
        dryRun: true,
        requiresConfirmation: false,
        risk,
        reason: 'Dry-run mode is active, so the tool call was planned but not executed.'
      };
    }

    if (risk === 'high' && !request.confirmed) {
      return {
        allowed: false,
        dryRun: false,
        requiresConfirmation: true,
        risk,
        reason: 'This FL Studio action can overwrite, delete, record-enable, export, or change plugin state and needs explicit confirmation.'
      };
    }

    if (mode === 'confirm_required' && !request.confirmed) {
      return {
        allowed: false,
        dryRun: false,
        requiresConfirmation: true,
        risk,
        reason: 'Confirmation is required before live FL Studio control.'
      };
    }

    return {
      allowed: true,
      dryRun: false,
      requiresConfirmation: false,
      risk,
      reason: 'Tool call is allowed for the current control mode.'
    };
  }

  getRisk(toolName: string): 'low' | 'medium' | 'high' {
    if (this.riskyTools.has(toolName) || RISKY_TOOL_PATTERNS.some(pattern => pattern.test(toolName))) {
      return 'high';
    }

    if (/set_|send_|trigger_|arm_|solo|mute/i.test(toolName)) {
      return 'medium';
    }

    return 'low';
  }
}
