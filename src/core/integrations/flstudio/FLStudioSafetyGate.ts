import { McpControlMode, McpPermissionGate } from '../../mcp/McpPermissionGate';

const FL_RISKY_TOOLS = [
  'fl_clear_piano_roll',
  'fl_delete_notes',
  'fl_overwrite_notes',
  'fl_mute_all',
  'fl_set_all_volumes',
  'fl_set_plugin_param_value',
  'fl_record',
  'fl_export',
  'fl_render'
];

export class FLStudioSafetyGate {
  private gate = new McpPermissionGate(FL_RISKY_TOOLS);

  evaluate(toolName: string, mode: McpControlMode, confirmed = false) {
    return this.gate.evaluate({ toolName, mode, confirmed });
  }
}
