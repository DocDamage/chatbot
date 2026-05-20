import { FLAutomationTool } from '../../../tools/music/FLAutomationTool';

export class FLAutomationCoach {
  private tool = new FLAutomationTool();

  advise(input: string) {
    return this.tool.run({ query: input });
  }
}
