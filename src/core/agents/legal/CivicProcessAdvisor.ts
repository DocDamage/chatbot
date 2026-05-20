import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class CivicProcessAdvisor {
  advise(input: string) {
    return createWorkflowGuidance('legal', 'CivicProcessAdvisor', input);
  }
}
