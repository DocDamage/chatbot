import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class FitnessPlanner {
  advise(input: string) {
    return createWorkflowGuidance('health', 'FitnessPlanner', input);
  }
}
