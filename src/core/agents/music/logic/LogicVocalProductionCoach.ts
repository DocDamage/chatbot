import { LogicVocalChainTool } from '../../../tools/music/LogicVocalChainTool';

export class LogicVocalProductionCoach {
  private tool = new LogicVocalChainTool();

  advise(input: string) {
    return this.tool.run({ query: input });
  }
}
