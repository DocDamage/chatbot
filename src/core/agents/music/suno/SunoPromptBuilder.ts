import { SunoPromptTool } from '../../../tools/music/SunoPromptTool';

export class SunoPromptBuilder {
  private promptTool = new SunoPromptTool();

  build(input: string) {
    return this.promptTool.run({ query: input });
  }
}
