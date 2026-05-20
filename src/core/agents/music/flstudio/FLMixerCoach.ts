import { FLMixerRoutingTool } from '../../../tools/music/FLMixerRoutingTool';

export class FLMixerCoach {
  private tool = new FLMixerRoutingTool();

  advise(input: string) {
    return this.tool.run({ query: input });
  }
}
