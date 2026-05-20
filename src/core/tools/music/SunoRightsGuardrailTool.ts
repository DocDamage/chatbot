import { SunoRightsAdvisor } from '../../agents/music/suno/SunoRightsAdvisor';

export class SunoRightsGuardrailTool {
  private advisor = new SunoRightsAdvisor();

  run(input: Record<string, any> = {}) {
    return {
      domain: 'music',
      tool: 'SunoRightsGuardrailTool',
      ...this.advisor.advise(String(input.query || ''))
    };
  }
}
