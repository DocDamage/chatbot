import { DawWorkflowTranslator } from '../../agents/music/DawWorkflowTranslator';

export class DawWorkflowMapTool {
  private translator = new DawWorkflowTranslator();

  run(input: Record<string, any> = {}) {
    return {
      ...this.translator.translate(String(input.query || '')),
      domain: 'music',
      tool: 'DawWorkflowMapTool'
    };
  }
}
