import { LogicMidiWorkflowTool } from '../../../tools/music/LogicMidiWorkflowTool';

export class LogicMidiCoach {
  private tool = new LogicMidiWorkflowTool();

  advise(input: string) {
    return this.tool.run({ query: input });
  }
}
