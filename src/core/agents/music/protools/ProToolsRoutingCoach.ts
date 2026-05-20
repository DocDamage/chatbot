import { ProToolsBusRoutingTool } from '../../../tools/music/ProToolsBusRoutingTool';

export class ProToolsRoutingCoach {
  private tool = new ProToolsBusRoutingTool();

  advise(input: string) {
    return this.tool.run({ query: input });
  }
}
