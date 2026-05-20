import { McpClientService, McpServerConfig } from '../../mcp/McpClientService';

export class FLStudioMcpClient {
  constructor(private mcpClient = new McpClientService()) {}

  connect(config: McpServerConfig = {}) {
    return this.mcpClient.connectServer({ id: 'fl-studio-mcp', ...config });
  }

  status() {
    return this.mcpClient.healthCheck();
  }

  listTools() {
    return this.mcpClient.listTools();
  }

  call(toolName: string, args: Record<string, any> = {}, dryRun = true) {
    return this.mcpClient.callTool(toolName, args, dryRun);
  }

  play(dryRun = true) {
    return this.call('fl_play', {}, dryRun);
  }

  stop(dryRun = true) {
    return this.call('fl_stop', {}, dryRun);
  }

  sendNotes(notes: any[], dryRun = true) {
    return this.call('fl_send_notes', { notes }, dryRun);
  }

  sendChord(notes: string[], time = 0, duration = 2, dryRun = true) {
    return this.call('fl_send_chord', { notes, time, duration }, dryRun);
  }

  setMixerVolume(track: number, dbChange: number, dryRun = true) {
    return this.call('fl_set_track_volume', { track, dbChange }, dryRun);
  }

  setMixerPan(track: number, pan: number, dryRun = true) {
    return this.call('fl_set_track_pan', { track, pan }, dryRun);
  }

  setStepSequence(channel: string, steps: number[], length = 16, dryRun = true) {
    return this.call('fl_set_step_sequence', { channel, steps, length }, dryRun);
  }

  getPianoRollState(dryRun = true) {
    return this.call('fl_get_piano_roll_state', {}, dryRun);
  }

  disconnect() {
    this.mcpClient.disconnect();
  }
}
