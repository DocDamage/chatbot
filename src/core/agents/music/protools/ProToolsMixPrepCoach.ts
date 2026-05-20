import { ProToolsExportStemTool } from '../../../tools/music/ProToolsExportStemTool';

export class ProToolsMixPrepCoach {
  private tool = new ProToolsExportStemTool();

  advise(input: string) {
    return this.tool.run({ query: input });
  }
}
