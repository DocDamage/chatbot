import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class EthicsAdvisor {
  advise(input: string) {
    return createWorkflowGuidance('philosophy', 'EthicsAdvisor', input);
  }
}
