import { LogicBounceExportTool } from '../../../tools/music/LogicBounceExportTool';

export class LogicExportAdvisor {
  private tool = new LogicBounceExportTool();

  advise(input: string) {
    return this.tool.run({ query: input });
  }
}
