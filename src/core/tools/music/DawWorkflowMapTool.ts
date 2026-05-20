import { DawWorkflowTranslator } from '../../agents/music/DawWorkflowTranslator';

export class DawWorkflowMapTool {
  private translator = new DawWorkflowTranslator();

  run(input: Record<string, any> = {}) {
    return {
      domain: 'music',
      tool: 'DawWorkflowMapTool',
      ...this.translator.translate(String(input.query || ''))
    };
  }
}
