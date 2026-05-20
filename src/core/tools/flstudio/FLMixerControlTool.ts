export class FLMixerControlTool {
  run(input: Record<string, any> = {}) {
    return {
      domain: 'flstudio',
      tool: 'FLMixerControlTool',
      actions: [
        { tool: 'fl_set_track_volume', args: { track: input.track || 6, dbChange: input.dbChange ?? -1.5 } },
        { tool: 'fl_set_track_pan', args: { track: input.track || 6, pan: input.pan ?? 0 } }
      ]
    };
  }
}
