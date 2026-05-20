import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class DependencyRiskAdvisor {
  advise(input: string) {
    return createWorkflowGuidance('security', 'DependencyRiskAdvisor', input);
  }
}
