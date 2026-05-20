import { ProToolsPostAudioTool } from '../../../tools/music/ProToolsPostAudioTool';

export class ProToolsPostProductionCoach {
  private tool = new ProToolsPostAudioTool();

  advise(input: string) {
    return this.tool.run({ query: input });
  }
}
