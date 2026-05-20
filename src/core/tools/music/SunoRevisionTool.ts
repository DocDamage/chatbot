import { SunoRevisionCoach } from '../../agents/music/suno/SunoRevisionCoach';

export class SunoRevisionTool {
  private coach = new SunoRevisionCoach();

  run(input: Record<string, any> = {}) {
    return {
      domain: 'music',
      tool: 'SunoRevisionTool',
      ...this.coach.revise(String(input.query || ''))
    };
  }
}
