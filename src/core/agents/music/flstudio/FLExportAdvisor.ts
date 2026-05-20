import { FLExportSettingsTool } from '../../../tools/music/FLExportSettingsTool';

export class FLExportAdvisor {
  private tool = new FLExportSettingsTool();

  advise(input: string) {
    return this.tool.run({ query: input });
  }
}
