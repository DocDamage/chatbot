import { LogicArrangementMarkerTool } from '../../../tools/music/LogicArrangementMarkerTool';

export class LogicArrangementCoach {
  private tool = new LogicArrangementMarkerTool();

  advise(input: string) {
    return this.tool.run({ query: input });
  }
}
