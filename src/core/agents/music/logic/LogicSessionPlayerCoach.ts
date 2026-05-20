import { LogicDrummerSessionPlayerTool } from '../../../tools/music/LogicDrummerSessionPlayerTool';

export class LogicSessionPlayerCoach {
  private tool = new LogicDrummerSessionPlayerTool();

  advise(input: string) {
    return this.tool.run({ query: input });
  }
}
