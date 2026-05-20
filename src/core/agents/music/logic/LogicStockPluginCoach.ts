import { LogicStockPluginChainTool } from '../../../tools/music/LogicStockPluginChainTool';

export class LogicStockPluginCoach {
  private tool = new LogicStockPluginChainTool();

  advise(input: string) {
    return this.tool.run({ query: input });
  }
}
