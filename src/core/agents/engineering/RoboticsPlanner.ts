import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class RoboticsPlanner {
  advise(input: string) {
    return createWorkflowGuidance('engineering', 'RoboticsPlanner', input);
  }
}
