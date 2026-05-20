import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class OperationsAdvisor {
  advise(input: string) {
    return createWorkflowGuidance('business', 'OperationsAdvisor', input);
  }
}
