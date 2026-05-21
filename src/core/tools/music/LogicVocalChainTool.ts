import { VocalChainTool } from './VocalChainTool';

export class LogicVocalChainTool {
  private vocalChain = new VocalChainTool();

  run(input: Record<string, any> = {}) {
    return {
      ...this.vocalChain.run({ ...input, daw: 'logic' }),
      domain: 'music',
      tool: 'LogicVocalChainTool'
    };
  }
}
