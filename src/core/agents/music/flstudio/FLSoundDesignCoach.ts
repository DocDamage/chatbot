import { FLGrossBeatAdvisorTool } from '../../../tools/music/FLGrossBeatAdvisorTool';
import { FLPluginChainTool } from '../../../tools/music/FLPluginChainTool';

export class FLSoundDesignCoach {
  private grossBeat = new FLGrossBeatAdvisorTool();
  private pluginChain = new FLPluginChainTool();

  advise(input: string) {
    return {
      domain: 'music',
      component: 'FLSoundDesignCoach',
      grossBeat: this.grossBeat.run({ query: input }),
      pluginChain: this.pluginChain.run({ query: input })
    };
  }
}
