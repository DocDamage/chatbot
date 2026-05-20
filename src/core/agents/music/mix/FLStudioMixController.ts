import { FLStudioControlAgent } from '../../../integrations/flstudio/FLStudioControlAgent';
import { McpControlMode } from '../../../mcp/McpPermissionGate';
import { MixMove } from './MixPlanner';

export class FLStudioMixController {
  constructor(private flStudioControlAgent?: FLStudioControlAgent) {}

  async apply(moves: MixMove[], options: Record<string, any> = {}) {
    const mode = this.normalizeMode(options.mode || 'dry_run');
    const actions = moves
      .filter(move => move.fl)
      .map(move => ({
        tool: move.fl!.tool,
        args: move.fl!.args,
        description: `${move.target}: ${move.action}`
      }));

    if (actions.length === 0) {
      return {
        applied: false,
        dryRun: true,
        actions: [],
        beforeSnapshot: undefined,
        message: 'No directly automatable FL Studio moves were generated for this pass.'
      };
    }

    if (!this.flStudioControlAgent) {
      return {
        applied: false,
        dryRun: true,
        actions,
        beforeSnapshot: undefined,
        message: 'FL Studio control agent is not available; returning planned actions only.'
      };
    }

    const beforeSnapshot = await this.captureBeforeSnapshot(mode);
    const result = await this.flStudioControlAgent.executeActions(actions, 'Apply mix pass moves.', {
      mode,
      confirmed: options.confirmed === true
    });
    return {
      ...result,
      beforeSnapshot
    };
  }

  private normalizeMode(mode: string): McpControlMode {
    if (mode === 'confirm_each_move') return 'confirm_required';
    if (mode === 'confirm_required' || mode === 'live_control') return mode;
    return 'dry_run';
  }

  private async captureBeforeSnapshot(mode: McpControlMode) {
    if (!this.flStudioControlAgent) return undefined;
    const status = this.flStudioControlAgent.status();
    const readMode: McpControlMode = status.connected && mode !== 'dry_run' ? 'live_control' : 'dry_run';
    const snapshot = await this.flStudioControlAgent.executeActions([
      {
        tool: 'fl_get_all_mixer_tracks',
        args: {},
        description: 'Capture mixer state before mix pass.'
      },
      {
        tool: 'fl_get_all_channels',
        args: {},
        description: 'Capture channel state before mix pass.'
      }
    ], 'Capture mix pass before snapshot.', {
      mode: readMode,
      confirmed: true
    });

    return {
      timestamp: new Date().toISOString(),
      connected: status.connected,
      mode: readMode,
      toolResults: snapshot.toolResults
    };
  }
}
