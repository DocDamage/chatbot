import { ProToolsEditWorkflowTool } from '../../../tools/music/ProToolsEditWorkflowTool';

export class ProToolsEditingCoach {
  private tool = new ProToolsEditWorkflowTool();

  advise(input: string) {
    return this.tool.run({ query: input });
  }
}
