import { VocalChainTool } from './VocalChainTool';

export class LogicVocalChainTool {
  private vocalChain = new VocalChainTool();

  run(input: Record<string, any> = {}) {
    return {
      domain: 'music',
      tool: 'LogicVocalChainTool',
      ...this.vocalChain.run({ ...input, daw: 'logic' })
    };
  }
}
