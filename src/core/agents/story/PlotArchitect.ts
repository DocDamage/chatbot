import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class PlotArchitect {
  advise(input: string) {
    return createWorkflowGuidance('story', 'PlotArchitect', input);
  }
}
