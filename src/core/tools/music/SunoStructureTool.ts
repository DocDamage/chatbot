import { SunoSongStructurePlanner } from '../../agents/music/suno/SunoSongStructurePlanner';

export class SunoStructureTool {
  private planner = new SunoSongStructurePlanner();

  run(input: Record<string, any> = {}) {
    return {
      domain: 'music',
      tool: 'SunoStructureTool',
      ...this.planner.plan(String(input.query || ''))
    };
  }
}
