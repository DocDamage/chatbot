export class FLTransportTool {
  run(input: Record<string, any> = {}) {
    const action = String(input.action || 'play').toLowerCase();
    return {
      domain: 'flstudio',
      tool: 'FLTransportTool',
      action: action === 'stop' ? 'fl_stop' : action === 'record' ? 'fl_record' : 'fl_play'
    };
  }
}
