import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class MechanicalAdvisor {
  advise(input: string) {
    return createWorkflowGuidance('engineering', 'MechanicalAdvisor', input);
  }
}
